function swap(a,b){
    var tmp = a;
    a = b;
    b = tmp;
}

//returns fraction of light reflected. fraction of light refracted equals 1 minus this value
function fresnel(ray, normal, refracIdx){
    var fracReflected = 0;
    var cosI = Math.max(Math.min(Vector.dotProduct(ray.vector, normal), 1), -1);
    var n1 = 1; //refractive idx of incident medium (assume is air)
    var n2 = refracIdx;

    if(cosI > 0){
        swap(n1, n2); //reverse the refractive indices if ray is travelling out of object into the air
    }

    var sinT = n1/n2 * Math.sqrt(Math.max(0, 1 - (cosI * cosI))); //snell's law
    if(sinT >= 1){
        fracReflected = 1; //total internal reflection
    } else {
        //https://en.wikipedia.org/wiki/Fresnel_equations#Power_(intensity)_reflection_and_transmission_coefficients
        var cosT = Math.sqrt(Math.max(0, 1 - (sinT*sinT))); //using trig identity sin^2 x + cos^2 x = 1
        cosI = Math.abs(cosI);
        var Rs = Math.pow(((n2*cosI) - (n1*cosT))/((n2*cosI) + (n1*cosT)),2); //reflectance of S-polarized light
        var Rp = Math.pow(((n1*cosI) - (n2*cosT))/((n1*cosI) + (n2*cosT)),2); //reflectance of P-polarized light
        fracReflected = (Rs+Rp)/2; //average of both
    }
    return fracReflected;
}

//calculates normalized refracted ray from intersection point
function calcRefractedRay(ray, normal, intersectionPt, refracIdx){
    var refractedRay = {
        point : intersectionPt,
        vector : new Point(0,0,0)
    };

    var cosI = Math.max(Math.min(1, Vector.dotProduct(ray.vector, normal)), -1);
    var n1 = 1;
    var n2 = refracIdx;
    
    if(cosI < 0){
        cosI = -cosI;
    } else {
        swap(n1, n2);
        normal = -normal;
    }

    var n1n2Ratio = n1/n2;
    var k = Math.sqrt(1 - (Math.pow((n1n2Ratio),2) * (1 - (cosI*cosI))));
    if(k < 0){
        return null;
    } else {
        refractedRay.vector = Vector.add(Vector.scale(ray.vector, n1n2Ratio), Vector.scale(normal,((n1n2Ratio * cosI) - k)));
        refractedRay.vector = Vector.unitVector(refractedRay.vector); //normalize
    }

    return refractedRay;
}

// # Surface
// If `trace()` determines that a ray intersected with an object, `surface`
// decides what color it acquires from the interaction.
function surface(ray, scene, octree, object, pointAtTime, intersectPtObjSpace, normal, depth) {
    if(object.isTransparent){
        var refractionColor = new Point(0,0,0);
        var reflectionColor = new Point(0,0,0);
        var fracReflected = fresnel(ray, normal, object.refracIdx); //compute fraction of light that is reflected
        var fracRefracted = 1 - fracReflected;

        if(fracRefracted > 0){ //if some light is refracted, calculate refracted light color
            var refractedRay = calcRefractedRay(ray, normal, pointAtTime, object.refracIdx); //returns normalized refracted ray, with origin biased
            if(refractedRay)
                refractionColor = trace(refractedRay, scene, octree, ++depth);
        }

        var reflectedRay = {
            point: pointAtTime,
            vector: Vector.reflectThrough(Vector.scale(ray.vector, -1), normal)
        };
        reflectionColor = trace(reflectedRay, scene, octree, ++depth);
            
        refractionColor = Vector.scale(refractionColor, fracRefracted);
        reflectionColor = Vector.scale(reflectionColor, fracReflected);

        return Vector.add(refractionColor, reflectionColor);

    } else { //normal object
        var objColor = {};
        if(object.enableTextureMap){
            objColor = scene.mapTextureFns[object.type](scene, object, pointAtTime, intersectPtObjSpace); //map texture
        } else {
            objColor= scene.mats[object.mat].color;
        }
        var c = Vector.ZERO;
        var specReflect = Vector.ZERO;
        var lambertAmount = Vector.ZERO;

        // **[Lambert shading](http://en.wikipedia.org/wiki/Lambertian_reflectance)**
        // is our pretty shading, which shows gradations from the most lit point on
        // the object to the least.

        if (scene.mats[object.mat].lambert) {
            for (var i = 0; i < scene.lights.length; i++) {
                var lightPoint = scene.lights[i].point;
     
                // First: can we see the light? If not, this is a shadowy area
                // and it gets no light from the lambert shading process.

			   var contribution = 0;
               if (isLightVisible(pointAtTime, scene, octree, lightPoint)){
                 // Otherwise, calculate the lambertian reflectance, which
                 // essentially is a 'diffuse' lighting system - direct light
                 // is bright, and from there, less direct light is gradually,
                 // beautifully, less light.
				 if(scene.lights[i].type == 'spot'){
					var lightDir = Vector.subtract(scene.lights[i].topoint, scene.lights[i].point);
					var lightToPt = Vector.subtract(pointAtTime, scene.lights[i].point); //get vector from light to intersection pt
					var angle = Math.acos(Vector.dotProduct(lightDir, lightToPt)/(Vector.length(lightDir)*Vector.length(lightToPt)))
					var angleDegrees = (angle*180)/Math.PI;
					if (scene.lights[i].angle >= angleDegrees) {
						contribution = Vector.dotProduct(Vector.unitVector(Vector.subtract(lightPoint, pointAtTime)), normal);
					}
				 } else { //normal omni light
                 	contribution = Vector.dotProduct(Vector.unitVector(Vector.subtract(lightPoint, pointAtTime)), normal);
				 }
                 if (contribution > 0) 
                   lambertAmount = Vector.add(lambertAmount, Vector.scale(scene.lights[i].color, contribution));
               }
            }
        }

        // for assn 5, adjust lit color by object color and divide by 255 since light color is 0 to 255
        lambertAmount = Vector.compScale(lambertAmount, objColor);
        lambertAmount = Vector.scale (lambertAmount, scene.mats[object.mat].lambert);
        lambertAmount = Vector.scale(lambertAmount, 1./255.);

        if (scene.mats[object.mat].specular){
            // 'Look' from a point on the surface of a shiny object, see what it sees and make that part of a reflection.
            var reflectedRay = {
                point: pointAtTime,
                vector: Vector.reflectThrough(Vector.scale(ray.vector, -1), normal)
            };

            //perturb reflected ray slightly for glossy reflection
            if(object.isGlossy){
                for(var i = 0; i < 1; ++i){
                    var vecU = Vector.crossProduct(reflectedRay.vector, normal);
                    var vecV = Vector.crossProduct(reflectedRay.vector, vecU);
                    var a = Math.random();
                    var b = Math.random();
                    var theta = Math.acos(1-a);
                    var phi = 2 * Math.PI * b;
                    a = Math.sin(phi) * Math.cos(theta)/16;
                    b = Math.sin(phi) * Math.sin(theta)/16;
                    reflectedRay.vector = Vector.add(reflectedRay.vector,
                            Vector.scale(Vector.unitVector(Vector.add3(reflectedRay.vector, Vector.scale(vecU, a), Vector.scale(vecV, b))), 0.25));
                }
                reflectedRay.vector = Vector.unitVector(reflectedRay.vector);
            }

            var reflectedColor = trace(reflectedRay, scene, octree, ++depth);
            if (reflectedColor) {  
                  c = Vector.add(c,Vector.scale(reflectedColor, scene.mats[object.mat].specular));
            }
        }

        //Add ambient component if any
        return Vector.add3(c,
            lambertAmount,
            Vector.scale(objColor, scene.mats[object.mat].ambient));
    }
}


