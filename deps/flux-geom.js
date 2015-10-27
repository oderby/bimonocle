
// Helper function to apply offset to geometry.
var moveGeometry = function(object, vector) {
    object.position.copy(vector);
    object.updateMatrix();
    object.geometry.applyMatrix(object.matrix);
    object.position.set(0, 0, 0);
};

// Helper function to apply rotation to geometry.
var rotateGeometry = function(object, vector) {
    object.rotation.set(vector.x, vector.y, vector.z);
    object.updateMatrix();
    object.geometry.applyMatrix(object.matrix);
    object.rotation.set(0, 0, 0);
};

// converts geometry to z-up world by setting ups axis and rotation order.
var convertToZUp = function(object) {
    object.up.set(0, 0, 1);
    object.rotation.order = 'YXZ'; // TODO(aki): Is this correct order ?
};

// Creates THREE scene and geometries from parasolid output.
// The method is called recursively for each array and Entities map.
function createObject(data) {

    // Results object: { THREE.Object3D, Set of Strings }
    var root = {mesh: null, invalidPrims: {}};
    if (!data) {
        return root;
    }
    if (data.primitive) {
        root.mesh = createPrimitive(data);
        if (!root.mesh) {
            root.invalidPrims[data.primitive] = true;
        }
    } //deprecated: this format is used for debugging stdlib blocks
    else if (data.Entities) {
        root.mesh = new THREE.Object3D();
        for (var i in data.Entities) {

            var results = createObject(data.Entities[i]);
            if (results.mesh) {
                root.mesh.add(results.mesh);
            }
            // merge in invalid prims from results
            //_.assign(root.invalidPrims, results.invalidPrims);
        }
        if (root.mesh.children.length===0) {
            root.mesh = null;
        }
    } else if (data instanceof Array) {
        root.mesh = new THREE.Object3D();
        var first = true;
        var index = -1;
        data.forEach(function(entityData) {
            var results = createObject(entityData);
            if (results.mesh) {
                // Tell three.js to update the matrix from the position attributes.
                results.mesh.updateMatrixWorld(true);
                // Merge the models for better performance, if possible (when materials are uniform)
                if (!results.mesh.materialProperties) {
                    if (first) {
                        // Only add a new mesh for the first entity
                        root.mesh.add(results.mesh);
                        index = root.mesh.children.length-1;
                        first = false;
                    } else { // !first
                        if (!root.mesh.children[index].geometry || root.mesh.children[index].geometry instanceof THREE.BufferGeometry) {
                            // buffer geometry can't merge, so just add another object
                            root.mesh.add(results.mesh);
                        } else { // regular (non buffer) geometry
                            root.mesh.children[index].geometry.merge(results.mesh.geometry,results.mesh.matrixWorld);
                        }
                    }
                }
                else { // !mergeModels
                    // each entity is a separate mesh
                    root.mesh.add(results.mesh);
                }
            }
            // merge in invalid prims from results
            //_.assign(root.invalidPrims, results.invalidPrims);
        }.bind(this));
        if(root.mesh.children.length===0) {
            root.mesh = null;
        }
        else {
            root.mesh.children.forEach( function (child) {
                if (!(child.geometry instanceof THREE.BufferGeometry)) {
                    // Convert to buffer geometry as an optimization for meshes
                    if(child.geometry && child.type === "Mesh") {
                        var bufferGeometry = new THREE.BufferGeometry().fromGeometry( child.geometry );
                        child.geometry = bufferGeometry;
                    }
                }
            });
        }
    }

    return root;
}

// Creates the Parasolid primitive.
function createPrimitive(data) {

    var mesh = undefined;
    var geometry = undefined;
    var material = undefined;

    var materialProperties;
    if (data.attributes !== undefined) {
        materialProperties = data.attributes.materialProperties;
    }
    materialProperties = materialProperties || data.materialProperties || {};
//    materialProperties = _.defaults(materialProperties, {side: THREE.DoubleSide});

    switch (data.primitive) {
        case 'cone':
            geometry = new THREE.CylinderGeometry(0, data.radius, data.height, 32);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            moveGeometry(mesh, new THREE.Vector3(0, data.height / 2, 0));
            rotateGeometry(mesh, new THREE.Vector3(Math.PI / 2, Math.PI / 2, 0));
            break;

        case 'cylinder':
            geometry = new THREE.CylinderGeometry(data.radius, data.radius, data.height, 32);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            moveGeometry(mesh, new THREE.Vector3(0, data.height / 2, 0));
            rotateGeometry(mesh, new THREE.Vector3(Math.PI / 2, Math.PI / 2, 0));
            break;

        case 'sphere':
            geometry = new THREE.SphereBufferGeometry(data.radius, 12, 8);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            rotateGeometry(mesh, new THREE.Vector3(Math.PI / 2, Math.PI / 2, 0));
            break;

        case 'torus':
            geometry = new THREE.TorusGeometry(data.major_radius, data.minor_radius, 24, 24);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        case 'block':
            geometry = new THREE.BoxGeometry(data.dimensions[0], data.dimensions[1], data.dimensions[2]);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            rotateGeometry(mesh, new THREE.Vector3(0, 0, 0));
            break;

        case 'circle':
            geometry = new THREE.CircleGeometry(data.radius, 32);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        case 'rectangle':
            geometry = new THREE.PlaneBufferGeometry(data.dimensions[0], data.dimensions[1], 1, 1);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        case 'plane':
            geometry = new THREE.PlaneBufferGeometry(10000, 10000, 100, 100);
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        case 'point':
        case 'point-2d':
            var positions = new Float32Array(3);
            geometry = new THREE.BufferGeometry();
            positions[0] = data.point[0];
            positions[1] = data.point[1];
            positions[2] = data.point[2] || 0;
            geometry.addAttribute('position',
                new THREE.BufferAttribute(positions, 3));
            geometry.computeBoundingBox();
            material = new THREE.PointsMaterial(materialProperties);
            mesh = new THREE.Points(geometry, material);
            break;

        case 'vector':
            var dir = new THREE.Vector3(data.coords[0], data.coords[1], data.coords[2] );
            var length = dir.length();
            var origin = new THREE.Vector3( 0, 0, 0 );
            if (length > 0) {
                dir.normalize();
            } else {
                console.warn("Vector primitive has length zero.")
            }
            // ArrowHelper handles creation of THREE Geometry and Material objects
            // and wraps them up in an Object3D
            mesh = new THREE.ArrowHelper( dir, origin, length);
            break;

        case 'line':
            geometry = new THREE.Geometry();
            geometry.vertices.push(new THREE.Vector3(
                data.start[0],
                data.start[1],
                data.start[2]
            ));
            geometry.vertices.push(new THREE.Vector3(
                data.end[0],
                data.end[1],
                data.end[2]
            ));
            material = new THREE.LineBasicMaterial(materialProperties);
            mesh = new THREE.Line(geometry, material);
            break;

        case 'curve':
            // TODO(aki): Test with more complex parasolid curves
            var nurbsControlPoints = [];
            var cp = data.controlPoints;
            for (var i = 0; i < cp.length; i++) {
                var w = 1;
                if (data.weights !== undefined) {
                    w = data.weights[i];
                }
                nurbsControlPoints.push(
                    new THREE.Vector4(
                        cp[i][0],
                        cp[i][1],
                        cp[i][2],
                        w // weight of control point: higher means stronger attraction
                    )
                );
            }

            // Respect the incoming parasolid knot vector length, which is
            // N + D + 1. See: http://www.rhino3d.com/nurbs/
            if (data.knots.length !== nurbsControlPoints.length + data.degree + 1) {
                console.warn('Number of uKnots in a NURBS curve should eaqual degree + N + 1, where N is the number of control points.');
            }

            var nurbsCurve = new THREE.NURBSCurve(
                data.degree, data.knots, nurbsControlPoints);
            geometry = new THREE.Geometry();
            // Set resolution of polyline for given number of control points and degree.
            var numPoints = cp.length * data.degree * 4;
            // Sample points for curves of degree >1, else render control points
            if (data.degree > 1) {
                geometry.vertices = nurbsCurve.getPoints(numPoints);
            } else {
                geometry.vertices = nurbsControlPoints;
            }
            material = new THREE.LineBasicMaterial(materialProperties);
            mesh = new THREE.Line(geometry, material);
            break;

        case 'mesh':
            geometry = new THREE.Geometry();

            data.vertices.forEach(function(vertex) {
                geometry.vertices.push(
                    new THREE.Vector3(vertex[0], vertex[1], vertex[2])
                );
            });

            data.faces.forEach(function(face) {
                if (face.length === 3) {
                    geometry.faces.push(
                        new THREE.Face3(face[0], face[1], face[2])
                    );
                } else if (face.length === 4) {
                    geometry.faces.push(
                        new THREE.Face3(face[0], face[1], face[2])
                    );
                    geometry.faces.push(
                        new THREE.Face3(face[0], face[2], face[3])
                    );
                }
            });

            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();

            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        // 'polygon-set' is deprecated, but we'll keep it around because
        // old projects may still generate data that uses it.
//        case 'polygon-set':
//        case 'polygonSet':
//            var allPolygons = new THREE.Geometry();
//            data.polygons.forEach(function(polygon) {
//                mesh = makeShapeFromPolygon_(polygon);
//                allPolygons.merge( mesh.geometry, mesh.matrix );
//            }.bind(this));
//            material = new THREE.MeshPhongMaterial(materialProperties);
//            mesh = new THREE.Mesh(allPolygons, material);
//            break;

        case 'polyline':
            geometry = new THREE.Geometry();
            for(var i = 0; i < data.points.length; i++) {
                geometry.vertices.push(new THREE.Vector3(
                    data.points[i][0],
                    data.points[i][1],
                    data.points[i][2]));
            }
            material = new THREE.LineBasicMaterial(materialProperties);
            mesh = new THREE.Line(geometry, material);
            break;

        case 'surface':
            var nsControlPoints = [];

            var cp = data.controlPoints;
            cp.forEach(function(cpRow, j) {
                var array = [];
                nsControlPoints.push(array);
                cpRow.forEach(function(point, k) {
                    var w = 1;
                    if (data.weights !== undefined) {
                        w = data.weights[k*cp.length + j];
                    }
                    array.push(
                        new THREE.Vector4(
                            point[0],
                            point[1],
                            point[2],
                            w // weight of control point: higher means stronger attraction
                        )
                    );
                });
            });


            // Respect the incoming parasolid knot vector length, which is
            // N + D + 1. See: http://www.rhino3d.com/nurbs/
            if (data.uKnots.length !== nsControlPoints[0].length + data.uDegree + 1) {
                console.warn('Number of uKnots in a NURBS surface should eaqual uDegree + N + 1, where N is the number of control points along U direction.');
            }
            if (data.vKnots.length !== nsControlPoints.length + data.vDegree + 1) {
                console.warn('Number of vKnots in a NURBS surface should eaqual vDegree + N + 1, where N is the number of control points along V direction.');
            }

            // nsControlPoints matrix has rows and columns swapped compared to three.js NURBSSurface.
            var nurbsSurface = new THREE.NURBSSurface(data.vDegree, data.uDegree, data.vKnots, data.uKnots, nsControlPoints);

            var getSurfacePoint = function(u, v) {
                return nurbsSurface.getPoint(u, v);
            };

            geometry = new THREE.ParametricGeometry(
                getSurfacePoint,
                // Set resolution of polyline for given number of control points and degree.
                    data.vDegree * nsControlPoints.length * 4,
                    data.uDegree * nsControlPoints[0].length * 4
            );
            geometry.computeFaceNormals();
            material = new THREE.MeshPhongMaterial(materialProperties);
            mesh = new THREE.Mesh(geometry, material);
            break;

        // TODO(aki): this is temporary
        // Note that the text is not a primitive supported by parasolid.
        case 'text':
            mesh = new THREE.TextHelper(data.text, {size: data.size, resolution: data.resolution, color: data.color, align: data.align});
            break;
    }

    if (mesh) {
        convertToZUp(mesh);
        if (data.origin) {
            mesh.position.set(
                data.origin[0],
                data.origin[1],
                    data.origin[2] || 0
            );
        }
        // Note: Axis, direction and normal appear to be the same except
        // that the 'normal' keyword is used in the context of the plane
        // primitive.
        // Direction is 'legacy' support for old values that may be hanging
        // out in people's data -- usage of the key is deprecated.
        // TODO(andrew): remove support for it.
        var axis = data.axis || data.direction || data.normal;
        if (axis) {
            mesh.lookAt(mesh.position.clone().add(
                new THREE.Vector3(
                    axis[0],
                    axis[1],
                    axis[2]
                )
            ));
        }

        if (data.attributes && data.attributes.tag) {
            mesh.userData.tag = data.attributes.tag;
        }

        // Attach materialProperties to mesh so that flux-materialUtil can
        // find it and update the material object with those parsed values.
        mesh.materialProperties = materialProperties;
        return mesh;
    }
    else {
        console.warn("Unsupported geometry type: " + data.primitive);
    }
}
