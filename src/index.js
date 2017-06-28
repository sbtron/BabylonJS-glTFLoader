/// <reference path="../../dist/preview release/babylon.d.ts" />

BABYLON.SceneLoader.ShowLoadingScreen = false;

var Options = function () {
    this.model = "Avocado";
    this.folder = "glTF";
    this.imageFormat = "png";
    this.environment = "country";
    this.attribution = "";
    this.pointLight = false;
    this.pointLightAngle = 0;
    this.showNormals = false;
};

var models = [
    "Alien",
    "AnimatedTriangle",
    "AppleTree",
    "Avocado",
    "BarramundiFish",
    "BoomBox",
    "Corset",
    "FarmLandDiorama",
    "Hourglass",
    "Lantern",
    "PillowPlane",
    "SimpleSkin",
    "SmilingFace",
    "Telephone",
    "WaterBottle"
];

var folders = [
    "glTF",
    "glTF-Binary",
    "glTF-pbrSpecularGlossiness",
];

var imageFormats = [
    "jpg",
    "png",
    "jpg-with-quantized-png"
];

// maps to attribution for image files here per cc license guidelines
// first element must match background name in gui menu
var environments = {
    "country": "http://www.openfootage.net/",
    "wobblyBridge": "https://hdrihaven.com/bundle.php?b=free_bundle",
    "gray": "http://www.microsoft.com/",
    "hill": "https://hdrihaven.com/bundle.php?b=free_bundle",
    "woods": "https://hdrihaven.com/bundle.php?b=free_bundle",
    "theater": "http://www.hdrlabs.com/",
    "darkPark": "http://noemotionhdrs.net/"
};

Options.Default = new Options();

var options = new Options();
var scene = null;
var model = null;
var camera = null;
var hdrTexture = null;
var skybox = null;
var light = null;
var sphere = null;
var lines = [];

function createScene() {
    var showGUI = true;

    var parameters = location.href.split("?")[1];
    if (parameters) {
        parameters = parameters.split("&");
        for (var i = 0; i < parameters.length; i++) {
            var parameter = parameters[i].split("=");
            switch (parameter[0]) {
                case "model":
                    options.model = parameter[1];
                    break;
                case "folder":
                    options.folder = parameter[1];
                    break;
                case "imageFormat":
                    options.imageFormat = parameter[1];
                    break;
                case "environment":
                    options.environment = parameter[1];
                    break;
                case "pointLight":
                    options.pointLight = (parameter[1] == "true");
                    break;
                case "showNormals":
                    options.showNormals = (parameter[1] == "true");
                    break;
                case "showGUI":
                    showGUI = (parameter[1] == "true");
                    break;
            }
        }
    }

    if (showGUI) {
        var gui = new dat.GUI({ autoplace: false, width: 400 });
        gui.add(options, "model", models).onChange(updateModel);
        gui.add(options, "folder", folders).onChange(updateModel);
        gui.add(options, "imageFormat", imageFormats).onChange(updateModel);
        gui.add(options, "environment", Object.keys(environments)).onChange(updateEnvironment);
        gui.add(options, "attribution").listen();
        gui.add(options, "pointLight").onChange(updateLight);
        gui.add(options, "pointLightAngle", 0, 360, 0.01).onChange(updateLightPosition);
        gui.add(options, "showNormals").onChange(updateLines);
    }

    scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;

    camera = new BABYLON.ArcRotateCamera("camera", 4.712, 1.571, 2, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(scene.getEngine().getRenderingCanvas());
    camera.minZ = 0.1;
    camera.maxZ = 100;
    camera.lowerRadiusLimit = 0.1;
    camera.upperRadiusLimit = 5;
    camera.wheelPrecision = 100;

    skybox = BABYLON.Mesh.CreateBox("hdrSkyBox", 100, scene);
    skybox.material = new BABYLON.PBRMaterial("skyBox", scene);
    skybox.material.backFaceCulling = false;
    skybox.material.microSurface = 1.0;
    skybox.material.cameraExposure = 0.6;
    skybox.material.cameraContrast = 1.6;
    skybox.material.disableLighting = true;
    skybox.infiniteDistance = true;

    updateEnvironment();
    updateModel();
    updateLight();
    updateLines();

    return scene;
}

function updateEnvironment() {
    options.attribution = environments[options.environment] || "";

    updateLink();

    if (hdrTexture) {
        hdrTexture.dispose();
    }

    hdrTexture = new BABYLON.HDRCubeTexture("src/images/" + options.environment + ".babylon.hdr", scene);

    if (skybox.material.reflectionTexture) {
        skybox.material.reflectionTexture.dispose();
    }

    skybox.material.reflectionTexture = hdrTexture.clone();
    skybox.material.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    updateModelReflectionTextures();
}

function updateModelReflectionTextures() {
    if (model) {
        model.getChildMeshes().forEach(function (mesh) {
            var material = mesh.material;
            if (material instanceof BABYLON.MultiMaterial) {
                material.subMaterials.forEach(function (subMaterial) {
                    if (subMaterial instanceof BABYLON.PBRMaterial) {
                        subMaterial.reflectionTexture = hdrTexture;
                    }
                });
            }
        });
    }
}

function updateModel() {
    updateLink();

    if (model) {
        model.dispose();
        model = null;
    }

    scene.skeletons = [];
    scene.morphTargetManagers = [];

    lines = [];

    var extension = options.folder.indexOf("Binary") !== -1 ? ".glb" : ".gltf";
    var rootUrl = "src/models/2.0/" + options.imageFormat + "/" + options.model + "/" + options.folder + "/";
    var fileName = options.model + extension;
    BABYLON.SceneLoader.Append(rootUrl, fileName, scene, function () {
        model = new BABYLON.Mesh("model", scene);
        scene.meshes.forEach(function (mesh) {
            if (!mesh.parent && mesh !== model && mesh !== skybox && mesh !== sphere) {
                mesh.setParent(model);
            }
        });

        var extents = getModelExtents();
        var size = extents.max.subtract(extents.min);
        var center = extents.min.add(size.scale(0.5));
        var maxSizeComponent = Math.max(size.x, size.y, size.z);
        var oneOverLength = 1 / maxSizeComponent;
        model.scaling.scaleInPlace(oneOverLength);
        model.position.subtractInPlace(center.scale(oneOverLength));

        updateModelReflectionTextures();
        updateLines();
    }, null, function (newScene) {
        alert("Model '" + options.model + "' failed to load");
    });
}

function getModelExtents() {
    var min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    var max = new BABYLON.Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    model.getChildMeshes().forEach(function (mesh) {
        mesh.computeWorldMatrix(true);
        var minBox = mesh.getBoundingInfo().boundingBox.minimumWorld;
        var maxBox = mesh.getBoundingInfo().boundingBox.maximumWorld;
        BABYLON.Tools.CheckExtends(minBox, min, max);
        BABYLON.Tools.CheckExtends(maxBox, min, max);
    });
    return {
        min: min,
        max: max
    };
}

function updateLight() {
    updateLink();

    if (!light) {
        light = new BABYLON.PointLight("light", BABYLON.Vector3.Zero, scene);
        sphere = BABYLON.Mesh.CreateSphere("sphere", 16, 0.05, scene);
        sphere.material = new BABYLON.PBRMaterial("sphere", scene);
    }

    light.setEnabled(options.pointLight);
    sphere.setEnabled(options.pointLight);

    updateLightPosition();
}

function updateLightPosition() {
    if (!light || !sphere) {
        return;
    }

    var angle = options.pointLightAngle * (Math.PI / 180);
    var position = new BABYLON.Vector3(Math.cos(angle), 0.5, Math.sin(angle));
    light.position = position;
    sphere.position = position.scale(1.1);
}

function updateLines() {
    updateLink();

    lines.forEach(function (meshLines) {
        if (meshLines.tangents) {
            meshLines.tangents.dispose();
        }

        if (meshLines.bitangents) {
            meshLines.bitangents.dispose();
        }

        if (meshLines.normals) {
            meshLines.normals.dispose();
        }
    });

    lines = [];

    if (!options.showNormals) {
        return;
    }

    scene.meshes.forEach(function (mesh) {
        if (mesh !== sphere && mesh !== skybox) {
            addLines(scene, mesh);
        }
    });
}

function addLines(scene, mesh) {
    var positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    var normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
    var tangents = mesh.getVerticesData(BABYLON.VertexBuffer.TangentKind);

    if (!positions || !normals) {
        return;
    }

    var scale = new BABYLON.Vector3();
    var rotation = new BABYLON.Quaternion();
    var position = new BABYLON.Vector3();
    mesh.getWorldMatrix().decompose(scale, rotation, position);
    var size = 0.1 / scale.length();

    var nlines = [];
    var tlines = [];
    var blines = [];
    for (var i = 0; i < normals.length; i++) {
        var v = BABYLON.Vector3.FromArray(positions, i * 3);
        var n = BABYLON.Vector3.FromArray(normals, i * 3);
        nlines.push([v, v.add(n.scale(size))]);

        if (tangents !== null) {
            var t4 = BABYLON.Vector4.FromArray(tangents, i * 4);

            var t = t4.toVector3();
            tlines.push([v, v.add(t.scale(size))]);

            var b = BABYLON.Vector3.Cross(n, t).scale(t4.w);
            blines.push([v, v.add(b.scale(size))]);
        }
    }

    var meshLines = {};

    meshLines.normals = BABYLON.MeshBuilder.CreateLineSystem("normalLines", { lines: nlines }, scene);
    meshLines.normals.color = new BABYLON.Color3(0, 0, 1);
    meshLines.normals.parent = mesh;

    if (tangents !== null) {
        meshLines.tangents = BABYLON.MeshBuilder.CreateLineSystem("tangentLines", { lines: tlines }, scene);
        meshLines.tangents.color = new BABYLON.Color3(1, 0, 0);
        meshLines.tangents.parent = mesh;

        meshLines.bitangents = BABYLON.MeshBuilder.CreateLineSystem("bitangentLines", { lines: blines }, scene);
        meshLines.bitangents.color = new BABYLON.Color3(0, 1, 0);
        meshLines.bitangents.parent = mesh;
    }

    lines.push(meshLines);
}

function updateLink() {
    var link = location.href.split("?")[0] + "?model=" + this.options.model;

    if (this.options.folder !== Options.Default.folder) {
        link += "&folder=" + this.options.folder;
    }

    if (this.options.imageFormat !== Options.Default.imageFormat) {
        link += "&imageFormat=" + this.options.imageFormat;
    }

    if (this.options.environment !== Options.Default.environment) {
        link += "&environment=" + this.options.environment;
    }

    if (this.options.pointLight !== Options.Default.pointLight) {
        link += "&pointLight=" + this.options.pointLight;
    }

    if (this.options.showNormals !== Options.Default.showNormals) {
        link += "&showNormals=" + this.options.showNormals;
    }

    window.history.replaceState(null, document.title, link);
}
