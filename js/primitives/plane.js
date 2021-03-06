// ## Detecting collisions against a plane

function planeIntersection(plane, ray) {
    /* Assume precomputed: 
    calc TInv matrix from Tx, Ty, Tz
    calc RInv matrix from rx, ry, rz
    calc SInv matrix from sx, sy, sz
    */    

    //transform ray into object space
    var rayPtArr = [ray.point.x, ray.point.y, ray.point.z, 1];
    rayPtArr = math.multiply(plane.SRTInv, rayPtArr);
    var rayVecArr = [ray.vector.x, ray.vector.y, ray.vector.z, 0];
    rayVecArr = math.multiply(plane.SRInv, rayVecArr);

    rayPtArr = rayPtArr.valueOf(); //get array representation back
    rayVecArr = rayVecArr.valueOf();
    var rayNew = {};
    rayNew.point = {x: rayPtArr[0], y: rayPtArr[1], z: rayPtArr[2]};
    rayNew.vector = {x: rayVecArr[0], y: rayVecArr[1], z: rayVecArr[2]};

    //p + td = 0 (for z component)
    var t = (-rayNew.point.z/rayNew.vector.z);

    if(t < 0.1){ //intersection pt is behind ray origin
        return;
    }

    //calculate intersection pt in object space to see if it lies in finite limits of plane
    var intersectionPt = Vector.add(rayNew.point, Vector.scale(rayNew.vector, t));
    if((intersectionPt.y < 0) || (intersectionPt.y > plane.height)){
        return; //outside the finite plane
    } else if((intersectionPt.x < 0) || (intersectionPt.x > plane.width)){
        return;
    }

    return [Vector.length(Vector.scale(ray.vector, t)), intersectionPt]; //actual intersection point = ray.point + ray.vector*t
}

function planeNormal(plane, pos, intersectPtObjSpace){
    var normalObjSpace = {x:0, y:0, z:1};

    //convert to world space
    var normalArr = [normalObjSpace.x, normalObjSpace.y, normalObjSpace.z, 0];
    normalArr = math.multiply(plane.R, math.multiply(plane.SInv, normalArr));
    normalArr = normalArr.valueOf();
    var normal = {x: normalArr[0], y: normalArr[1], z: normalArr[2]};

    return Vector.unitVector(normal);
}

function planeColor(scene, plane, point, intersectPtObjSpace){
    var intersectionPtnew = intersectPtObjSpace;

    //the plane primitive is the xy-plane, so transform x,y coords to u,v coords in image
    //calculate cylindrical coordinates, then transform to u,v coords
    var u = Math.abs(intersectionPtnew.x);
    var v = Math.abs(intersectionPtnew.y);
    u = Math.round((u/plane.width)*scene.textures[plane.texture].width); //scale to [0-imgWidth]
    v = Math.round((v/plane.height)*scene.textures[plane.texture].height);
    var objColor = {};
    objColor.x = scene.textures[plane.texture].data.data[(scene.textures[plane.texture].width*v*4) + (u*4)];
    objColor.y = scene.textures[plane.texture].data.data[(scene.textures[plane.texture].width*v*4) + (u*4) + 1];
    objColor.z = scene.textures[plane.texture].data.data[(scene.textures[plane.texture].width*v*4) + (u*4) + 2];
    return objColor;
}

function updatePlane(plane, timeStep){
    var vx = plane.Vx;
    var vy = plane.Vy;
    var vz = plane.Vz;
    plane.Tx+=(vx*timeStep);
    plane.boundingBoxPos.x+=(vx*timeStep);
    plane.Ty+=(vy*timeStep);
    plane.boundingBoxPos.y+=(vy*timeStep);
    plane.Tz+=(vz*timeStep);
    plane.boundingBoxPos.z+=(vz*timeStep);
}
