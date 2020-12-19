var fs = require('fs');
var gates_json = JSON.parse(fs.readFileSync('api/data/gates.json', 'utf8'));

var shengen_prefixes = ["EL", "EH", "EB", "ED", "LP", "LO", "LK", "EK", "EE", "EF", "LG", "LH", "BI", "LI", "EV", "EY", "LM", "EN", "EP", "LP", "LZ", "LJ", "LE", "ES", "LS"];
var cargo_icaos = ["FDX", "QTR", "UPS", "UAE", "CPA", "KAL", "GEC", "CLX", "DHL", "CSN", "BCS"];
var low_costs_icaos = ["RYR", "EJU", "WZZ"];
var VFR_AC = ["B190", "C750", "C172", "CRJ", "M20P"]

function vectorDistance(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
}

function locationDistance(location1, location2) {
    var dx = location1.latitude - location2.latitude,
        dy = location1.longitude - location2.longitude;
    return vectorDistance(dx, dy);
}

function toRadians(degree){
    return degree * (Math.PI / 180)
}

function worldDistance(location1, location2){
    var dlong = toRadians(location2.longitude) - toRadians(location1.longitude),
        dlat = toRadians(location2.latitude) - toRadians(location1.latitude),
        ans = Math.pow(Math.sin(dlat / 2), 2) 
            + Math.cos(toRadians(location1.latitude)) * Math.cos(toRadians(location2.latitude))
            * Math.pow(Math.sin(dlong / 2), 2)
        ans = 2 * Math.asin(Math.sqrt(ans));
        return ans * 3440.1
}
  

function closestLocation (targetLocation, locationData) {
    const THRESHOLD = 0.035
    closest =  locationData.reduce(function(prev, curr) {
        var prevDistance = worldDistance(targetLocation , prev),
            currDistance = worldDistance(targetLocation , curr);
        return (prevDistance < currDistance) ? prev : curr;
    });
    return worldDistance(targetLocation, closest) <= THRESHOLD ? closest: null
}

function get_gate_for_position  (lat, long){
    return closestLocation({"latitude": lat, "longitude":long},gates_json)
}

function is_on_brussels_ground  (lat, long, altitude){
    if(lat < 50.915 && lat > 50.886 && long < 4.524 && long > 4.45 && altitude < 200){
        return true
    }else{
        return false
    }
}

function get_valid_aprons (callsign, origin, actype){
    var i;
    for(i=0;i<VFR_AC.length;i++){
        if (actype.startsWith(VFR_AC[i])){
            return ["apron-60"]
        }
    }
    for(i=0;i<cargo_icaos.length;i++){
        if(callsign.startsWith(cargo_icaos[i])){
            return ["apron-9"];
        }
    }
    for(i=0;i<low_costs_icaos.length;i++){
        if(callsign.startsWith(low_costs_icaos[i])){
            return ["apron-1-north-low-cost"];
        }
    }
    for(i=0;i<shengen_prefixes.length;i++){
        if (origin.startsWith(shengen_prefixes[i])){
            return ["apron-1-south", "apron-1-north"];
        }
    }
    return ["apron-2-north", "apron-2-south"];
}

module.exports = {
    vectorDistance: vectorDistance,
    locationDistance: locationDistance,
    worldDistance: worldDistance,
    closestLocation: closestLocation,
    get_gate_for_position: get_gate_for_position,
    is_on_brussels_ground: is_on_brussels_ground,
    get_valid_aprons: get_valid_aprons
}