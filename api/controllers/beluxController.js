const fetch = require("node-fetch");
const _ = require('underscore');
const Datastore = require('nedb')
const f = require('./helpFunctions.js');

require('dotenv').config();
let DEBUG = process.env.VERBOSE || false;

let pilots_of_interest = null;
let controllers_of_interest = null;
let monitored_clients = {}
let last_updated = Date.now()

const belux_positions = ["EBBU", "EBBR", "EBOS", "EBAW", "EBCI", "EBLG" , "ELLX"]
const airports_of_interest = ["EBBR", "ELLX"]
const location_coordinates = {
    "EBBR" : {"latitude": 50.902, "longitude": 4.485},
    "EBCI" : {"latitude": 50.4647, "longitude": 4.4611},
    "ELLX" : {"latitude": 49.6313, "longitude": 6.2157}
}
const relevant_controllers = {
    "EBBR" : ["EBBR_DEL", "EBBR_GND", "EBBR_N_GND", "EBBR_TWR", "EBBR_N_TWR", "EBBR_APP", "EBBR_F_APP", "EBBR_DEP","EBBU_E_CTR", "EBBU_CTR", "EBBU_W_CTR"],
    "ELLX" : ["ELLX_TWR", "ELLX_APP", "ELLX_F_APP", "EBBU_E_CTR", "EBBU_CTR", "EBBU_W_CTR"]
    // "EBAW" : ["EBAW_GND", "EBAW_TWR", "EBBR_DEP", "EBBR_APP", "EBBU_E_CTR", "EBBU_CTR", "EBBU_W_CTR"],
    // "EBOS" : ["EBOS_GND", "EBOS_TWR", "EBOS_APP",, "EBBU_CTR", "EBBU_W_CTR"],
    // "EBCI" : ["EBCI_GND", "EBCI_TWR", "EBCI_APP", "EBBR_DEP", "EBBR_APP", "EBBR_S_APP", "EBBU_E_CTR", "EBBU_CTR", "EBBU_W_CTR"],
    // "EBLG" : ["EBLG_GND", "EBLG_TWR", "EBLG_APP", "EBBU_CTR", "EBBU_E_CTR"]
}

// INJECT DATA IN DATABASE
const db = new Datastore();
const json = require('../data/gates.json');
const { rest } = require("underscore");
const { is_on_zone } = require("./helpFunctions.js");
db.insert(json, function(err, result){
     if(!err){
        if (DEBUG) console.log("succesfully imported gate data")
         db.update({}, {$set:{"occupied":false, "assigned_to": "none"}},{multi:true})
     }
});

set_gate_to_callsign("EBBR", "120", "TEST1");
set_gate_to_callsign("EBBR", "122", "TEST2");
set_gate_to_callsign("EBBR", "134", "TEST3");
set_gate_to_callsign("EBBR", "126", "TEST4");

set_gate_to_callsign("EBBR", "433", "TEST5");
set_gate_to_callsign("EBBR", "442", "TEST6");
set_gate_to_callsign("EBBR", "316", "TEST7");
set_gate_to_callsign("EBBR", "330", "TEST8");

set_gate_to_callsign("EBBR", "696", "TEST9");
set_gate_to_callsign("EBBR", "690", "TEST10");
set_gate_to_callsign("EBBR", "680", "TEST11");
set_gate_to_callsign("EBBR", "683", "TEST12");

set_gate_to_callsign("EBBR", "685", "TEST13");
set_gate_to_callsign("EBBR", "687", "TEST14");
set_gate_to_callsign("EBBR", "693", "TEST15");
set_gate_to_callsign("EBBR", "699", "TEST16");

set_gate_to_callsign("EBBR", "526", "TEST17");
set_gate_to_callsign("EBBR", "588", "TEST18");
set_gate_to_callsign("EBBR", "584", "TEST19");
set_gate_to_callsign("EBBR", "582", "TEST20");

set_gate_to_callsign("EBBR", "574", "TEST21");
set_gate_to_callsign("EBBR", "566", "TEST22");
set_gate_to_callsign("EBBR", "550", "TEST23");
set_gate_to_callsign("EBBR", "524", "TEST24");

set_gate_to_callsign("EBBR", "520", "TEST25");
set_gate_to_callsign("EBBR", "516", "TEST26");
set_gate_to_callsign("EBBR", "512", "TEST27");
set_gate_to_callsign("EBBR", "510", "TEST28");

set_gate_to_callsign("EBBR", "354", "TEST29");
set_gate_to_callsign("EBBR", "304", "TEST30");
set_gate_to_callsign("EBBR", "306", "TEST31");
set_gate_to_callsign("EBBR", "443", "TEST32");



async function get_all_gates(){
    const gate_list = await new Promise((resolve, reject) => {
        db.find({}, {"_id": 0, "__v":0}).sort({occupied : -1, apron:1 }).exec((err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate_list
}

async function get_all_gates_for_airport(airport){
    const gate_list = await new Promise((resolve, reject) => {
        db.find({"airport":airport}, {"_id": 0, "__v":0}).sort({occupied : -1, apron:1 }).exec((err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate_list
}

async function get_all_possible_gates_for(airport, ac, apron_input){
    let [aprons, backup_aprons] = apron_input

    if(airport == "EBBR" && ac == "A388"){
        const super_gates = ["233R", "322", "328"]
        const gate_list = await new Promise((resolve, reject) => {
            db.find({"airport":airport, "gate":{ $in: super_gates}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
        return (gate_list.length > 0 ? [gate_list[0]] : [])
    }
    /* Find all gates on specific apron */
    let gate_list = await new Promise((resolve, reject) => {
        db.find({"airport":airport, "apron": { $in: aprons}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    /* When all gates on apron are occupied, use backup apron*/
    if(gate_list.length == 0){
        gate_list = await new Promise((resolve, reject) => {
            db.find({"airport":airport, "apron": { $in: backup_aprons}, "occupied":false}, {"_id": 0, "__v":0}).sort({apron: 1}).exec((err, result) => {
                if (err) reject(err);
                resolve(result);
            });
        });
    }
    return gate_list
}

async function get_all_assigned_gates(){
    const gate_list = await new Promise((resolve, reject) => {
        db.find({"occupied":true}, {"_id": 0, "__v":0, "apron":0, "latitude":0, "longitude":0, "occupied":0}).exec((err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    // const reduced_list = Array.from(
    //     gate_list.reduce((a, {airport, ...rest})=>{
    //         return a.set(airport, [rest].concat(a.get(airport)||[]));
    //     }, new Map())
    // )//.map(([group, children]) => ({group, children}));
    // console.log(JSON.stringify(reduced_list))
    return gate_list
}

async function get_gate_for_gateid(airport, gate_id){
    const gate_obj = await new Promise((resolve, reject) => {
        db.findOne({"airport":airport, "gate": gate_id}, {"_id": 0, "__v":0}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate_obj
}

async function get_gate_for_callsign(callsign){
    const gate_obj = await new Promise((resolve, reject) => {
        db.findOne({"assigned_to" : callsign},{"_id": 0, "__v":0, "apron":0, "latitude":0, "longitude":0}, (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
    return gate_obj
}

async function set_gate_to_callsign(airport, gate_id, callsign){
    /* Check if gate exists */
    let gate_obj = await get_gate_for_gateid(airport, gate_id);
    if(gate_obj == null){
        if (DEBUG) console.log("ERR: gate " + gate_id + " does not exist");
        return {success: false, code: "GATE_NOT_EXIST", error: "Gate "+ gate_id+" does not exist"}
    }
    /* Check if gate is not occupied */
    if (gate_obj.occupied){ 
        if (DEBUG) console.log("ERR: gate " + gate_id + " already assigned to " + gate_obj.assigned_to);
        return {success: false, code: "GATE_OCCUPIED", error: "Gate "+ gate_id+ "already occupied"}
    }

    /* Check if callsign already has a reservation, if yes, return error*/
    const curr_reservation = await get_gate_for_callsign(callsign);
    if (curr_reservation != null){ 
        if (DEBUG) console.log("ERR: "+ callsign +" already assigned to gate: " + curr_reservation.gate)
        return {success: false, code: "CS_ALREADY_ASSIGNED", error: callsign + " already assigned to a gate"}
    }

    /* Update gate */
    gate_obj.occupied = true;
    gate_obj.assigned_to = callsign;
    const result_obj = await new Promise((resolve, reject) => {
        db.update({"airport":airport, "gate": gate_id}, gate_obj, function(err, result){
            if (err) reject(err);
            resolve(gate_obj);
        });
    });
    return {success: true, result: result_obj};
}

async function clear_gate(airport, gate_id){
    let gate_obj = await get_gate_for_gateid(airport, gate_id);
    gate_obj.occupied = false;
    gate_obj.assigned_to = "none";
    const result_obj = await new Promise((resolve, reject) => {
        db.update({"airport":airport, "gate": gate_id}, gate_obj, function(err, result){
            if (err) reject({success: false, error: err});
            resolve({success: true, result: gate_obj});
        });
    });
    return result_obj;
}


async function set_gate_for(callsign, airport, gateid){
    let old_gate_obj = await get_gate_for_callsign(callsign);
    /*Only clear old gate if callsign already has a gate assigned*/
    if(old_gate_obj != null && old_gate_obj.occupied){
        const result_obj = await clear_gate(old_gate_obj.airport, old_gate_obj.gate);
    }
    const new_gate = await set_gate_to_callsign(airport,gateid, callsign);
    return new_gate
}

async function request_gate_on_apron(airport, callsign, ac, apron){
    const gates_list = await get_all_possible_gates_for(airport, ac, apron);

    let temp_gate_obj = gates_list[Math.floor(Math.random() * gates_list.length)];
    let result_obj = await set_gate_to_callsign(airport, temp_gate_obj.gate, callsign)

    while(!result_obj.success){
        temp_gate_obj = gates_list[Math.floor(Math.random() * gates_list.length)];
        result_obj = await set_gate_to_callsign(airport, temp_gate_obj.gate, callsign)
    }
    return result_obj
}

async function load_active_clients(){
    // let intresting_clients = await fetch('https://data.vatsim.net/v3/vatsim-data.json')
    let intresting_clients = await fetch('https://api.beluxvacc.org/belux-active-runways/vatsim-clients', {
        headers: {
          "Authorization": 'Basic YmVsdXhfY2xpZW50XzIwMjE6T2ZlZEN1enRRSW1PemN3Z2h3cjU1QQ=='
        }
    })
    .then(res => {
        if(!res.ok){ console.error("failed vatsim json fetch"); throw res}
        return res.json()
    })
    .then((out) => {
        pilots_of_interest = []
        controllers_of_interest = []
        let i;
        for(i=0; i< out.pilots.length;i++){
            const client =  out.pilots[i]
            const location_client = {"latitude": client.latitude, "longitude": client.longitude} 
            if(client.flight_plan != null){
                if (airports_of_interest.includes(client.flight_plan.departure) && f.worldDistance(location_client, location_coordinates[client.flight_plan.departure]) < 300){
                    pilots_of_interest.push(client)
                }
                else if (airports_of_interest.includes(client.flight_plan.arrival)  && f.worldDistance(location_client, location_coordinates[client.flight_plan.arrival]) < 300){
                    pilots_of_interest.push(client)
                }
            }else{
                let k;
                for(k=0;k<airports_of_interest.length;k++){
                    if(is_on_zone(f.airport_zones[airports_of_interest[k]], client.latitude, client.longitude, client.altitude)){
                        pilots_of_interest.push(client)
                        break;
                    }
                }
            }
        }
        for(i=0;i< out.controllers.length;i++){
            const client = out.controllers[i]
            if (belux_positions.includes(client.callsign.substring(0,4))){
                controllers_of_interest.push(client)
            }
        }

        return { "pilots": pilots_of_interest, "controllers": controllers_of_interest}
    })
    .catch((err) => {
        return null;
    });
    if(intresting_clients != null){
        last_updated = Date.now()
        return await process_clients(intresting_clients).catch((err)=> console.log(err))
    }
}

async function process_clients(clients){
    let i, output_pilots=[], output_controllers=[];
    if(DEBUG){
        console.log(`processing ${clients.pilots.length} pilots`)
        console.time("process_clients")
    } 
    for (const [key, client] of Object.entries(clients.pilots)) {
        const callsign = client.callsign
        const lat = client.latitude
        const long = client.longitude
        const altitude = client.altitude
        const ground_speed = client.groundspeed

        let result_obj = null;
        if(!client.flight_plan){
            let flight_object = {}
            flight_object.callsign = callsign;
            flight_object.status = "at_gate_unfilled"
            let cur_gate_obj = await get_gate_for_callsign(callsign);
            if (cur_gate_obj == null){
                const closestGate = f.get_gate_for_position(lat, long);
                const gate_obj = await get_gate_for_gateid(closestGate.airport, closestGate.gate);
                if(gate_obj.occupied == true){
                       /* Gate was already assigned => double booking
                           Make new reservation for that other client */
                        const other_callsign = gate_obj.assigned_to;
                        const other_apron = gate_obj.apron;
                        const other_airport = gate_obj.airport
                        result_obj = await clear_gate(gate_obj.airport, gate_obj.gate);
                        if (!result_obj.success && DEBUG) console.log(result_obj)

                        result_obj = await request_gate_on_apron(other_airport, other_callsign, "ZZZ", [[other_apron], [other_apron]]);
                        if (!result_obj.success && DEBUG) console.log(result_obj)
                }
                result_obj = await set_gate_to_callsign(gate_obj.airport,gate_obj.gate, callsign); 
                if (!result_obj.success && DEBUG) console.log(result_obj)

                monitored_clients[callsign] = "AUTO-DEP"
                cur_gate_obj = result_obj
            }
            flight_object.type = "D"
            flight_object.dep_airport = {}
            flight_object.dep_airport.icao = cur_gate_obj.airport;

            flight_object.assigned_gate = cur_gate_obj.gate;
            output_pilots.push(flight_object)
            continue;
        }

        const arrival = client.flight_plan.arrival
        const departure = client.flight_plan.departure
        const flight_rule = client.flight_plan.flight_rules

        let AC_code = client.flight_plan.aircraft.split("/")[0]
        if (AC_code.length==1){
            AC_code = client.flight_plan.aircraft.split("/")[1];
        }

        const arr_airport_info = f.get_airport_info(client.flight_plan.arrival)
        const dep_airport_info = f.get_airport_info(client.flight_plan.departure)
        const ac_info = f.get_aircraft_info(AC_code)

        const both_airports_of_intrest = airports_of_interest.includes(arrival) && airports_of_interest.includes(departure)
        let both_airports_already_processed = null

        let flight_object = {}
        flight_object.callsign = callsign;
        flight_object.flight_rule = flight_rule;
        flight_object.dep_airport = {}
        flight_object.dep_airport.icao = client.flight_plan.departure;
        if(dep_airport_info)
            flight_object.dep_airport.detailed = (dep_airport_info.name + " (" + dep_airport_info.country+")")
        else
            flight_object.dep_airport.detailed = "Airport unknown"
        
        flight_object.arr_airport = {}
        flight_object.arr_airport.icao = client.flight_plan.arrival
        if(arr_airport_info)
            flight_object.arr_airport.detailed = (arr_airport_info.name + " (" + arr_airport_info.country+")")
        else
            flight_object.arr_airport.detailed = "Airport unknown"
        
        flight_object.aircraft = {}
        flight_object.aircraft.icao = AC_code;
        if(ac_info)
            flight_object.aircraft.detailed = ac_info.name;
        else
            flight_object.aircraft.detailed = "AC type unknown"
        
        /*Standard empty fields*/
        flight_object.miles_out = ''
        flight_object.eta = ''
        flight_object.eta_till_gate = ''

        /* IF AC on ground */
        const on_dep_ground = (client.flight_plan.departure in f.airport_zones ?  f.is_on_zone(f.airport_zones[client.flight_plan.departure], lat, long, altitude) : false);
        const on_arr_ground = (client.flight_plan.arrival in f.airport_zones ?  f.is_on_zone(f.airport_zones[client.flight_plan.arrival], lat, long, altitude) : false);
        if (on_dep_ground || on_arr_ground){
            const closestGate = f.get_gate_for_position(lat, long);
            // CHECK gate reservation OK
            if (closestGate == null){
                flight_object.status = "taxing"
                if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                    const gate_obj = await get_gate_for_callsign(callsign);
                    if(gate_obj!=null){
                        const result_obj = await clear_gate(gate_obj.airport, gate_obj.gate); 
                        if(result_obj.success){
                            delete monitored_clients[callsign]
                            if (DEBUG) console.log("cleared gate for departing " + callsign)
                        }
                    }
                }
            }else{
                // AC is at gate
                flight_object.status = "at_gate"
                const cur_gate_obj = await get_gate_for_callsign(callsign);
                if (cur_gate_obj == null){
                    const gate_obj = await get_gate_for_gateid(closestGate.airport, closestGate.gate);
                    if(gate_obj.occupied == true){
                        /* Gate was already assigned => double booking
                           Make new reservation for that other client */
                        const other_callsign = gate_obj.assigned_to;
                        const other_apron = gate_obj.apron;
                        const other_airport = gate_obj.airport
                        result_obj = await clear_gate(gate_obj.airport, gate_obj.gate);
                        if (!result_obj.success && DEBUG) console.log(result_obj)

                        result_obj = await request_gate_on_apron(other_airport, other_callsign, "ZZZ", [[other_apron], [other_apron]]);
                        if (!result_obj.success && DEBUG) console.log(result_obj)
                    }
                    result_obj = await set_gate_to_callsign(gate_obj.airport,gate_obj.gate, callsign); 
                    if (!result_obj.success && DEBUG) console.log(result_obj)

                    monitored_clients[callsign] = "AUTO-DEP"
                }else{
                    if((cur_gate_obj.gate != closestGate.gate) && (cur_gate_obj.airport != closestGate.airport)){
                        //Free reservation
                        result_obj = await clear_gate(cur_gate_obj.airport, cur_gate_obj.gate);
                        if (!result_obj.success && DEBUG) console.log(result_obj);

                        //Book clossest gate
                        result_obj = await set_gate_to_callsign(closestGate.airport,closestGate.gate, callsign); 
                        if (!result_obj.success && DEBUG) console.log(result_obj)
                    }
                }
            }
            flight_object.type = (on_dep_ground ? "D" : "A")
            
            result_obj = await get_gate_for_callsign(callsign);
            const gate = (result_obj== null ? "": (result_obj.gate))
            flight_object.assigned_gate = gate;
            
            output_pilots.push(flight_object)

            if(both_airports_of_intrest){
                both_airports_already_processed = flight_object.type 
            }else{
                continue
            }
        }

        /* IF AC NOT ON GROUND ANYMORE/YET*/
        if(airports_of_interest.includes(client.flight_plan.departure) && (!both_airports_of_intrest || both_airports_already_processed != "D")){
            if ( callsign in monitored_clients && monitored_clients[callsign] == "AUTO-DEP"){
                const gate_obj = await get_gate_for_callsign(callsign)
                if(gate_obj!=null){
                    const result_obj = await clear_gate(gate_obj.airport, gate_obj.gate);  
                    if(result_obj.success){
                        delete monitored_clients[callsign]
                        if (DEBUG) console.log("cleared gate for departed " + callsign)
                    }
                }
            }
            if(both_airports_of_intrest && both_airports_already_processed == null){
                both_airports_already_processed = flight_object.type 
            }else{
                continue
            }
        }
        if(airports_of_interest.includes(client.flight_plan.arrival) && (!both_airports_of_intrest || both_airports_already_processed != "A")){
            const location_client = {"latitude": lat, "longitude": long} 
            //const dest_airport = (["ELLX","EBBR"].includes(client.flight_plan.arrival)?"EBCI": client.flight_plan.arrival) //Hack for south arrivals in brussels
            const arr_distance = parseInt(f.worldDistance(location_client, location_coordinates["EBCI"]))
            let cur_gate = null;
            if(parseInt(ground_speed) < 50)
                continue
            if (arr_distance < 150){
                cur_gate = await get_gate_for_callsign(callsign);
                if (cur_gate == null){
                    const aprons = f.get_valid_aprons(client.flight_plan.arrival, callsign,client.flight_plan.departure, AC_code, client.flight_plan.remarks.toUpperCase().includes("CARGO"));
                    cur_gate = await request_gate_on_apron(client.flight_plan.arrival, callsign, AC_code, aprons);

                    if (!cur_gate.success && DEBUG) console.log(cur_gate)
                    monitored_clients[callsign] = "AUTO_ARR"
                }
            }

            result_obj = await get_gate_for_callsign(callsign);
            const gate_id = (result_obj ? result_obj.gate : "")

            const ETA = parseInt(arr_distance/parseInt(ground_speed)*60)
            let ETA_till_gate = parseInt((arr_distance-150)/parseInt(ground_speed)*60)
            ETA_till_gate = ((gate_id == "" && ETA_till_gate > 0) ? (ETA_till_gate+1) : '')


            flight_object.status = "arriving"
            flight_object.type = "A"
            flight_object.miles_out = arr_distance
            flight_object.eta = ETA
            flight_object.eta_till_gate = ETA_till_gate
            flight_object.assigned_gate = gate_id
            output_pilots.push(flight_object)
        }
    }
    for (const [key, client] of Object.entries(clients.controllers)) {
        output_controllers.push(
            {
                "callsign"      : client.callsign,
                "logon_time"    : client.logon_time,
                "name"          : client.name,
                "frequency"     : client.frequency     
            }
        )
    }
    if(DEBUG){
        console.timeEnd("process_clients")
    } 
    pilots_of_interest = output_pilots
    controllers_of_interest = output_controllers
    return {"status": "ok"}
}

function bookkeep_clients(){
    Object.keys(monitored_clients).forEach(async function(key){
        let i, found=false;
        for (i=0;i<pilots_of_interest.length;i++){
            if (pilots_of_interest[i]["callsign"] == key)
                found = true
        }
        if (!found){
            const gate_obj = await get_gate_for_callsign(key);
            if(gate_obj != null){
                const result_obj = await clear_gate(gate_obj["airport"], gate_obj["gate"]);
                if (!result_obj.success && DEBUG) console.log(result_obj)
                delete monitored_clients[key]
                if (DEBUG) console.log("cleared gate for logged off " + key)
            }
        }
    });
}

setTimeout(load_active_clients, 2*1000);
setInterval(load_active_clients, 90*1000);
setInterval(bookkeep_clients, 120*1000);

/* API FUNCTIONS */

/* /GET/all_gates */
exports.list_all_gates = async function(req, res) {
    let gates = null;
    if ( req.params.airport){
        airport = req.params.airport.toUpperCase();
        gates = await get_all_gates_for_airport(airport)
    }else{
        gates = await get_all_gates()
    }
    res.json(gates);
};

/* /POST/all_gates/:airport/ */
exports.list_all_valid_gates = async function(req, res) {
    if(req.params.airport)
        airport = req.params.airport.toUpperCase();
    else
        airport = "EBBR"
    callsign = req.body.callsign;
    origin = req.body.origin;
    ac = req.body.aircraft;

    const aprons = f.get_valid_aprons(airport, callsign, origin, ac)
    const gates =  await get_all_possible_gates_for(airport, ac, aprons)
    res.json(gates)
};

/* /GET/get_gate/:gateid*/
exports.get_gate_for_id = async function(req, res){
    airport = req.params["airport"].toUpperCase();;
    gate_id = req.params["gateid"];

    const gate = await get_gate_for_gateid(airport, gate_id)
    res.json(gate == null? [] : gate);
};

/* /POST/get_gate*/
exports.get_gate_for_callsign = async function(req, res){
    callsign = req.body.callsign;
    
    const gate_obj = await get_gate_for_callsign(callsign)
    res.json(gate_obj == null? [] : {gate:gate_obj.gate, assigned_to: gate_obj.assigned_to})
}

exports.get_all_assigned_gates = async function(req, res){
    const gate_list = await get_all_assigned_gates()
    res.json(gate_list)
}

/* /POST/set_random_gate */
exports.set_random_gate = async function(req, res){
    callsign = req.body.callsign;
    airport = req.body.airport.toUpperCase();;
    origin = req.body.origin;
    ac = req.body.aircraft;

    const aprons = f.get_valid_aprons(airport, callsign,origin, ac);
    const result_obj =  await request_gate_on_apron(airport, callsign, ac, aprons);
    if (!result_obj.success){
        res.status(500).send(
        {
            error: {
                status: 500,
                message: result_obj.error,
            }
        });
    }else{
        res.json(result_obj.result)
        monitored_clients[callsign] = "MANUAL"
        load_active_clients();
    }
};

/* /POST/set_gate */
exports.set_gate = async function(req, res){
    callsign = req.body.callsign;
    requested_airport = req.body.airport;
    requested_gateid = req.body.gate_id;


    const result_obj = await set_gate_for(callsign, requested_airport, requested_gateid)
    if (!result_obj.success){
        res.status(500).send(
        {
            error: {
                status: 500,
                message: result_obj.error,
            }
        });
    }else{
        res.json(result_obj.result)
        monitored_clients[callsign] = "MANUAL"
        load_active_clients();
    }
}

/* /POST/clear_gate/ */
exports.clear_gate = async function(req, res){
    callsign = req.body.callsign;
    const gate_obj = await get_gate_for_callsign(callsign);
    if(gate_obj == null){
        res.status(500).send(
            {
                error: {
                    status: 500,
                    message: "Callsign is not assigned to gate",
                }
            });
    }

    const result_obj = await clear_gate(gate_obj.airport, gate_obj.gate)
    if (!result_obj.success){
        res.status(500).send(
        {
            error: {
                status: 500,
                message: result_obj.error,
            }
        });
    }else{
        delete monitored_clients[callsign]
        res.json({
            "cleared_gate": result_obj.result.gate
        })
        load_active_clients();
    }
}

/* /GET/get_pilots */
exports.get_active_pilots = function(req, res){
    if(req.params.airport && pilots_of_interest != null){
        airport = req.params.airport.toUpperCase();
        filtered_clients = pilots_of_interest.filter(function(el){
            return (el.arr_airport && el.arr_airport.icao == airport && el.type=="A") || (el.dep_airport && el.dep_airport.icao == airport && el.type == "D")
        });
        res.json({"updated": last_updated, "clients": filtered_clients});
    }else{
        res.json({"updated": last_updated, "clients": pilots_of_interest});
    }
}

/* /GET/get_controllers */
exports.get_active_controllers = function(req, res){
    if(req.params.airport && controllers_of_interest != null){
        airport = req.params.airport.toUpperCase();
        filtered_clients = controllers_of_interest.filter(function(el){
            return relevant_controllers[airport].includes(el.callsign)
        })
        res.json({"updated": last_updated, "clients": filtered_clients});
    }else{
        res.json({"updated": last_updated, "clients": controllers_of_interest});
    }
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
            "active"   : false,
        },
    ])
}