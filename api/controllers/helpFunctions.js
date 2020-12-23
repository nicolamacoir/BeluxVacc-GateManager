var fs = require('fs');
var gates_json = JSON.parse(fs.readFileSync('api/data/gates.json', 'utf8'));

var shengen_prefixes = ["EL", "EH", "EB", "ED", "LP", "LO", "LK", "EK", "EE", "EF", "LG", "LH", "BI", "LI", "EV", "EY", "LM", "EN", "EP", "LP", "LZ", "LJ", "LE", "ES", "LS"];
var cargo_icaos = ['DHL', 'DHK', 'BCS', 'CLX','FDX', 'BOX','GEC','TAY','ABW','CTJ','MSX','LCO','QAC','SQC','CKS','PAC','UPS','ABD','MZN','NPT','NCA','MPH','ABR','AHK','GTI','CKK','DSR','NWA','EIA']
var low_costs_icaos = ['RYR', 'EZY', 'EZS', 'EJU', 'LDA', 'LDM', 'WZZ'];
var GA_AC = {
                'A' :      ['AEST'],
                'B' :      ['B18T','B190','B350','B36T','BE10','BE17','BE18','BE20','BE23','BE24','BE30','BE35','BE36','BE40','BE50','BE55','BE58','BE60','BE65','BE70','BE76','BE77','BE80','BE88','BE95','BE99','BE9L','BE9T'],
                'C' :      ['C02T','C06T','C07T','C10T','C120','C140','C150','C152','C162','C170','C172','C175','C177','C180','C182','C185','C188','C190','C195','C25C','C205','C206','C207','C208','C210','C21T','C25A','C25B','C303','C310','C320','C335','C336','C337','C340','C402','C404','C411','C414','C421','C425','C441','C500','C501','C510','C525','C526','C550','C551','C560','C56X','C650','C680','C72R','C750','C77R','C82R','COL3','COL4'],
                'E' :      ['EVOT','EVOP'],
                'J' :      ['J2','J3','J4','J5'],
                'L' :      ['LNC2','LNCE','LNT4','LEG2','LNP4','LJ23','LJ25','LJ31','LJ35','LJ40','LJ45','LJ55','LJ60'],
                'P' :      ['P28A','P28B','P28R','P28S','P28T','P28U','P32R','P32T','P46T','PA11','PA12','PA14','PA15','PA16','PA17','PA18','PA20','PA22','PA23','PA24','PA25','PA27','PA30','PA31','PA32','PA34','PA36','PA38','PA44','PA46','PA47','PAT4','PAY1','PAY2','PAY3','PAY4','PILL'],
                'T' :      ['TGRS','TBM9'],
                'S' :      ['SNGY','SR22','S108']
}

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

function detect_GA(actype){
    var first_letter = actype.charAt(0);
    if(first_letter in GA_AC){
        if (GA_AC[first_letter].includes(actype))
            return true;
    }
    return false;
}

function get_valid_aprons (callsign, origin, actype){
    var i;
    if(detect_GA(actype)){
        return ["GA"];
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
    get_valid_aprons: get_valid_aprons,
    detect_GA: detect_GA
}