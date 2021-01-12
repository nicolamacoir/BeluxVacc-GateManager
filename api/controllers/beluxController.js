const fetch = require("node-fetch");
var _ = require('underscore');
var Datastore = require('nedb')
var f = require('./helpFunctions.js')


var DEBUG = false;

// INJECT DATA IN DATABASE
var db = new Datastore();
var json = require('../data/gates.json');
db.insert(json, function(err, result){
     if(!err){
        if (DEBUG) console.log("succesfully imported!")
         db.update({}, {$set:{"occupied":false, "assigned_to": "none"}},{multi:true})
     }
});

let active_clients = null;
let monitored_clients = {}
let last_updated = Date.now()

const airports_of_interest = ["EBBR", "ELLX"]
const location_coordinates = {
    "EBBR" : {"latitude": 50.902, "longitude": 4.485},
    "EBCI" : {"latitude": 50.4647, "longitude": 4.4611},
    "ELLX" : {"latitude": 49.6313, "longitude": 6.2157}
}

async function get_all_gates(){
    var gates = await new Promise((resolve, reject) => {
        db.find({}, {"_id": 0, "__v":0}).sort({occupied : -1, apron:1 }).exec((err, count) => {
            if (err) reject(err);
            resolve(count);
        });
    });
    return gates
}

async function get_all_gates_for_airport(airport){
    var gates = await new Promise((resolve, reject) => {
        db.find({"airport":airport}, {"_id": 0, "__v":0}).sort({occupied : -1, apron:1 }).exec((err, count) => {
            if (err) reject(err);
            resolve(count);
        });
    });
    return gates
}

async function get_all_possible_gates_for(airport, ac, apron){
    var aprons = apron[0], backup_aprons = apron[1]

    if(airport == "EBBR" && ac == "A388"){
        var super_gates = ["233R", "322", "328"]
        var gates = await new Promise((resolve, reject) => {
            db.find({"airport":airport, "gate":{ $in: super_gates}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
        return (gates.length > 0 ? [gates[0]] : [])
    }
    /* Find all gates on specific apron */
    var gates = await new Promise((resolve, reject) => {
        db.find({"airport":airport, "apron": { $in: aprons}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    /* When all gates are occupied, use backup apron*/
    if(gates.length == 0){
        gates = await new Promise((resolve, reject) => {
            db.find({"airport":airport, "apron": { $in: backup_aprons}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }
    return gates
}

async function get_gate_for_gateid(airport, gate_id){
    var gate = await new Promise((resolve, reject) => {
        db.findOne({"airport":airport, "gate": gate_id}, {"_id": 0, "__v":0}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate
}

async function get_gate_for_callsign(callsign,ac_type=null){
    var gate = await new Promise((resolve, reject) => {
        db.findOne({"assigned_to" : callsign},{"_id": 0, "__v":0, "apron":0, "latitude":0, "longitude":0, "occupied":0}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate
}

async function set_gate_to_callsign(airport, gate_id, callsign){

    /* Check if gate is not occupied */
    var cur_gate = await get_gate_for_gateid(airport, gate_id);
    if (cur_gate.assigned_to != "none"){ 
        if (DEBUG) console.log("ERR: gate " + gate_id + " already assigned to " + cur_gate.assigned_to);
        return "ERR: gate already occupied"
    }

    /* Check if already has a reservation, if yes, return error*/
    var curr_reservation = await get_gate_for_callsign(callsign);
    if (curr_reservation != null){ 
        if (DEBUG) console.log("ERR: "+ callsign +" already assigned to gate: " + gate_id)
        return "ERR: already assigned to a gate"
    }
    
    /* Get gate */
    var gate = await new Promise((resolve, reject) => {
        db.findOne({"airport":airport, "gate": gate_id}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });

    /* Gate exists, if no return error */
    if (gate != null){
        /* Update gate */
        gate.occupied = true;
        gate.assigned_to = callsign;
        var result = await new Promise((resolve, reject) => {
            db.update({"airport":airport, "gate": gate_id}, gate, function(err, result){
                if (err) reject(err);
                resolve(gate);
            });
        });

       return result;
    }else{
        return "ERR: gate does not exist";
    }
}

async function clear_gate(airport, gate_id){
    var gate = await new Promise((resolve, reject) => {
        db.findOne({"airport":airport, "gate": gate_id}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    gate.occupied = false;
    gate.assigned_to = "none";
    var result = await new Promise((resolve, reject) => {
        db.update({"airport":airport, "gate": gate_id}, gate, function(err, result){
            if (err) reject(err);
            resolve("OK");
        });
    });
    return result;
}


async function request_gate_for(airport, callsign, origin, ac){
    var aprons = f.get_valid_aprons(airport, callsign,origin, ac);
    return await request_gate_on_apron(airport, callsign, ac, aprons);
}

async function request_gate_on_apron(airport, callsign, ac, apron){
    var gates = await get_all_possible_gates_for(airport, ac, apron);
    var temp_gate = gates[Math.floor(Math.random() * gates.length)];

    var result = await set_gate_to_callsign(airport, temp_gate["gate"], callsign)
    while(typeof result === 'string' && result.startsWith("ERR")){
        var temp_gate = gates[Math.floor(Math.random() * gates.length)];
        var result = await set_gate_to_callsign(airport, temp_gate["gate"], callsign)
    }
    return result
}

async function load_active_clients(){
    var intresting_clients = await fetch('https://data.vatsim.net/vatsim-data.json')
    .then(res => {
        if(!res.ok){ if (DEBUG) console.error("failed vatsim json fetch"); throw res}
        return res.json()
    })
    .then((out) => {
        clients = []
        var i;
        for(i=0; i< out["clients"].length;i++){
            var client =  out["clients"][i]
            var location_client = {"latitude": client["latitude"], "longitude": client["longitude"]} 
            if (airports_of_interest.includes(client["planned_depairport"]) && f.worldDistance(location_client, location_coordinates[client["planned_depairport"]]) < 300){
                clients.push(client)
            }
            else if (airports_of_interest.includes(client["planned_destairport"])  && f.worldDistance(location_client, location_coordinates[client["planned_destairport"]]) < 300){
                clients.push(client)
            }
        }
        return clients
    })
    .catch((err) => {
        return null;
    });
    if(intresting_clients != null){
        last_updated = Date.now()
        return await process_clients(intresting_clients)
    }
}

async function process_clients(clients){
    var i, output_clients=[];
    for (const [key, client] of Object.entries(clients)) {
        var callsign = client["callsign"]
        var lat = client["latitude"],
            long = client["longitude"],
            altitude = client["altitude"],
            status = "UNKNOWN",
            arr_distance = '',
            ETA = '',
            ETA_till_gate = '',
            AC_code = client["planned_aircraft"].split("/")[0];
            ground_speed = client["groundspeed"]
        
        if (AC_code.length==1){
            AC_code = client["planned_aircraft"].split("/")[1];
        }

        var on_dep_ground = (client["planned_depairport"] in f.airport_zones ?  f.is_on_zone(f.airport_zones[client["planned_depairport"]], lat, long, altitude) : false);
        var on_arr_ground = (client["planned_destairport"] in f.airport_zones ?  f.is_on_zone(f.airport_zones[client["planned_destairport"]], lat, long, altitude) : false);

        if (on_dep_ground || on_arr_ground){
            var closestGate = f.get_gate_for_position(lat, long);
            // CHECK gate reservation OK
            if (closestGate == null){
                status = "taxing"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                    var gate = await get_gate_for_callsign(callsign);
                    if(gate!=null){
                        var result = await clear_gate(gate["airport"], gate["gate"]); 
                        delete monitored_clients[callsign]
                        if (DEBUG) console.log("deleted " + callsign)
                    }
                }
            }else{
                // AC is at gate
                var cur_gate = await get_gate_for_callsign(callsign);
                if (cur_gate == null){
                    let gate = await get_gate_for_gateid(closestGate["airport"], closestGate["gate"]);
                    if(gate.occupied == true){
                        /* Gate was already assigned => double booking
                           Make new reservation for that client */
                        var other_callsign = gate.assigned_to;
                        var other_apron = gate.apron;
                        var other_airport = gate.airport
                        clear_gate(gate["gate"]);
                        request_gate_on_apron(other_airport, other_callsign, AC_code, [other_apron]);
                    }
                    var result = set_gate_to_callsign(gate["airport"],gate["gate"], callsign); 
                    monitored_clients[callsign] = "AUTO-DEP"
                    load_active_clients();
                }
                status = "at_gate"
            }
        }else{
            if(airports_of_interest.includes(client["planned_depairport"])){
                status = "departed"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                    var gate = await get_gate_for_callsign(callsign)
                    if(gate!=null){
                        var result = await clear_gate(gate["airport"], gate["gate"]); 
                        delete monitored_clients[callsign]
                        if (DEBUG) console.log("deleted " + callsign)
                    }
                }
            }else{
                var location_client = {"latitude": lat, "longitude": long} 
                var dest_airport = (client["planned_destairport"]=="EBBR"?"EBCI": client["planned_destairport"]) //Hack for south arrivals in brussels
                arr_distance = parseInt(f.worldDistance(location_client, location_coordinates[dest_airport]))
                if(parseInt(ground_speed) < 50)
                    /* not yet departed from origin*/
                    continue
                if (arr_distance < 150){
                    var cur_gate = await get_gate_for_callsign(callsign);
                    if (cur_gate == null){
                        var result = await request_gate_for(client["planned_destairport"], callsign, client["planned_depairport"], AC_code)
                        monitored_clients[callsign] = "AUTO_ARR"
                    }
                }
                ETA = parseInt(arr_distance/parseInt(ground_speed)*60);
                ETA_till_gate = parseInt((arr_distance-150)/parseInt(ground_speed)*60)
                status = "arriving"
            }
        }
        var result = await get_gate_for_callsign(callsign);
        var gate = (result== null ? "": (result["gate"])) 
        output_clients.push(
            {"type"     : (airports_of_interest.includes(client["planned_depairport"]) ? "D":"A"),
             "callsign" : callsign, 
             "dest_airport"  : client["planned_destairport"],
             "dep_airport"   : client["planned_depairport"],
             "ac"       : AC_code,
             "status"   : status,
             "distance" : arr_distance,
             "eta"      : ETA,
             "eta_till_gate": ((ETA_till_gate) > 0 ? (ETA_till_gate +1) : ''),
             "reservation": (arr_distance < 150 ?gate : '')
            }
        );

    }
    active_clients = output_clients
    return {"status": "ok"}
}

function bookkeep_clients(){
    Object.keys(monitored_clients).forEach(async function(key){
        var i, found=false;
        for (i=0;i<active_clients.length;i++){
            if (active_clients[i]["callsign"] == key)
                found = true
        }
        if (!found){
            if (DEBUG) console.log("cleaning up " + key)
            var gate = await get_gate_for_callsign(key);
            var result = await clear_gate(gate["airport"], gate["gate"]);
            delete monitored_clients[key]
        }
    });
}

setTimeout(load_active_clients, 2*1000);
setInterval(load_active_clients, 90*1000);
setInterval(bookkeep_clients, 120*1000);

/* API FUNCTIONS */

/* /GET/all_gates */
exports.list_all_gates = async function(req, res) {
    var gates = await get_all_gates()
    res.json(gates);
};

/* /GET/all_gates/:airport/ */
exports.list_all_gates_for_airport = async function(req, res) {
    airport = req.params["airport"].toUpperCase();
    var gates = await get_all_gates_for_airport(airport)
    res.json(gates);
};

/* /POST/all_gates/:airport/ */
exports.list_all_valid_gates = async function(req, res) {
    airport = req.params["airport"].toUpperCase();;
    callsign = req.body.callsign;
    origin = req.body.origin;
    ac = req.body.aircraft;

    var aprons = f.get_valid_aprons(airport, callsign, origin, ac)
    var gates =  await get_all_possible_gates_for(airport, ac, aprons)
    res.json(gates)
};

/* /GET/get_gate/:gateid*/
exports.get_gate_for_id = async function(req, res){
    airport = req.params["airport"].toUpperCase();;
    gate_id = req.params["gateid"];

    var gate = await get_gate_for_gateid(airport, gate_id)
    res.json(gate);
};

/* /POST/get_gate*/
exports.get_gate_for_callsign = async function(req, res){
    callsign = req.body.callsign;
    
    var gate = await get_gate_for_callsign(callsign)
    res.json(gate == null? [] : gate)
}

/* /POST/request_gate */
exports.request_gate = async function(req, res){
    callsign = req.body.callsign;
    airport = req.body.airport.toUpperCase();;
    origin = req.body.origin;
    ac = req.body.aircraft;

    var result = await request_gate_for(airport,callsign, origin, ac);
    res.json(result);
    monitored_clients[callsign] = "MANUAL"
};

/* /POST/change_gate */
exports.change_gate = async function(req, res){
    callsign = req.body.callsign;
    requested_gateid = req.body.gate_id;

    var old_gate = await get_gate_for_callsign(callsign);
    var result = await clear_gate(old_gate["airport"], old_gate["gate"]);
    var new_gate = await set_gate_to_callsign(old_gate["airport"],requested_gateid, callsign);
    if(typeof new_gate === 'string' && new_gate.startsWith("ERR")){
        res.status(500).send(
        {
            error: {
              status: 500,
              message: new_gate,
            }
        });
    }else{
        res.json(new_gate);
        monitored_clients[callsign] = "MANUAL"
        load_active_clients();
    }
}

/* /POST/toggle_reservation/:gateid */
exports.toggle_reservation = async function(req, res){
    callsign = req.body.callsign;
    var requested_gateid = req.params["gateid"];
    var requested_airport = req.params["airport"].toUpperCase();;

    var gate = await get_gate_for_gateid(requested_airport,requested_gateid);
    if (gate.occupied == true){
        var result = await clear_gate(requested_airport,requested_gateid);
    }else{
        var result = await set_gate_to_callsign(requested_airport, requested_gateid, callsign);
    }
    monitored_clients[callsign] = "MANUAL";
    res.json(result);
    load_active_clients();
}

/* /GET/get_clients */
exports.get_active_clients = function(req, res){
    airport = req.params["airport"].toUpperCase();
    filtered_clients = active_clients.filter(function(el){
        return el.dest_airport == airport || el.dep_airport == airport
    });
    res.json({"updated": last_updated, "clients": filtered_clients});
}

/* /GET/force_get_clients */
exports.force_reload_clients= async function(req, res){
    await load_active_clients()
    res.json({"status": "OK"})
}


exports.get_available_airports = function(req, res){
    res.json([
        {  "icao"      : "EBBR",
           "active"    : true,
        },
        {
            "icao"     : "ELLX",
            "active"   : true,
        },
        {
            "icao"     : "EBCI",
            "active"   : false,
        },
        {
            "icao"     : "EBOS",
            "active"   : false,
        },
        {
            "icao"     : "EBAW",
            "active"   : false,
        },
        {
            "icao"     : "EBLG",
            "active"   : true,
        },
    ])
}