var light = null;
var sphere = null;

function loadScene() {
    function resizeEventListener() {
        engine.resize();
    }

    if (engine) {
        alpha = camera.alpha;
        beta = camera.beta;
        radius = camera.radius;

        window.removeEventListener("resize", resizeEventListener);
        engine.stopRenderLoop();
        engine.dispose();
    }

    engine = new BABYLON.Engine(canvas, true);
    engine.enableOfflineSupport = false;

    var extension = options.folder.indexOf("Binary") !== -1 ? ".glb" : ".gltf";
    var rootUrl = "models/2.0/" + options.imageFormat + "/" + options.model + "/" + options.folder + "/";
    var fileName = options.model + extension;

    BABYLON.GLTFFileLoader.IncrementalLoading = false;

    BABYLON.SceneLoader.ShowLoadingScreen = false;

    BABYLON.SceneLoader.Load(rootUrl, fileName, engine, function (scene) {
        camera = new BABYLON.ArcRotateCamera("camera", alpha, beta, radius, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas);
        camera.wheelPrecision = 100.0;
        camera.minZ = 0.1;
        camera.maxZ = 1000;

        if (options.environment) {
            options.attribution = environments[options.environment] || "";

            var hdrTexture = new BABYLON.HDRCubeTexture("images/" + options.environment + ".babylon.hdr", scene);

            for (var i = 0; i < scene.meshes.length; i++) {
                var material = scene.meshes[i].material;
                if (material instanceof BABYLON.MultiMaterial) {
                    for (var j = 0; j < material.subMaterials.length; j++) {
                        var subMaterial = material.subMaterials[j];
                        if (subMaterial instanceof BABYLON.PBRMaterial) {
                            subMaterial.reflectionTexture = hdrTexture;
                        }
                    }
                }
            }

            var hdrSkybox = BABYLON.Mesh.CreateBox("hdrSkyBox", 1000.0, scene);
            var hdrSkyboxMaterial = new BABYLON.PBRMaterial("skyBox", scene);
            hdrSkyboxMaterial.backFaceCulling = false;
            hdrSkyboxMaterial.reflectionTexture = hdrTexture.clone();
            hdrSkyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
            hdrSkyboxMaterial.microSurface = 1.0;
            hdrSkyboxMaterial.cameraExposure = 0.6;
            hdrSkyboxMaterial.cameraContrast = 1.6;
            hdrSkyboxMaterial.disableLighting = true;
            hdrSkybox.material = hdrSkyboxMaterial;
            hdrSkybox.infiniteDistance = true;
        }

        if (options.pointLight) {
            light = new BABYLON.PointLight("light", BABYLON.Vector3.Zero, scene);
            sphere = BABYLON.Mesh.CreateSphere("sphere", 16, 0.05, scene);
            sphere.material = new BABYLON.PBRMaterial("sphere", scene);
            updateLightPosition();
        }

        if (options.showTangentSpace) {
            for (var i = 0; i < scene.meshes.length; i++) {
                var mesh = scene.meshes[i];
                if (mesh.id !== "sphere") {
                    addTangentSpaceLines(scene, mesh);
                }
            }
        }

        engine.runRenderLoop(function () {
            scene.render();
        });
    });

    window.addEventListener("resize", resizeEventListener);
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

function addTangentSpaceLines(scene, mesh) {
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

    var normalLines = BABYLON.MeshBuilder.CreateLineSystem("normalLines", { lines: nlines }, scene);
    normalLines.color = new BABYLON.Color3(0, 0, 1);
    normalLines.parent = mesh;

    if (tangents !== null) {
        var tangentLines = BABYLON.MeshBuilder.CreateLineSystem("tangentLines", { lines: tlines }, scene);
        tangentLines.color = new BABYLON.Color3(1, 0, 0);
        tangentLines.parent = mesh;

        var bitangentLines = BABYLON.MeshBuilder.CreateLineSystem("bitangentLines", { lines: blines }, scene);
        bitangentLines.color = new BABYLON.Color3(0, 1, 0);
        bitangentLines.parent = mesh;
    }
}
