let last_state = null;
let clients = null;
let all_circles = {};
let clientTable = null;
let gatesTable = null;
let controllerTable = null;
let map = null;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let current_airport = urlParams.get('airport') || "EBBR"


let airport_coordinates = {
    "EBBR" : [50.90118840716608, 4.484539077304007],
    "ELLX" : [49.6297897197352, 6.2162681227702885],
    "EBCI" : [50.46192932354443, 4.460618192308619],
    "EBLG" : [50.64031963770841, 5.446233689939522],
    "EBAW" : [51.18937047833322, 4.462371309978565],
    "EBOS" : [51.2006618161849, 2.8728886305868517]
}

async function update_all( e, dt, node, config ) {
    //var response = await fetch(hostname + '/force_get_clients');
    clientTable.ajax.reload();
    controllerTable.ajax.reload();
    var date = new Date(clientTable.ajax.json()["updated"]);
    $("div.toolbar").html('<b>Last updated: ' + date.toTimeString() + '</b>');
    update_map();
}
setInterval(update_all, 120*1000);

$(document).ready(function() {
    /* get clients */
    controllerTable = $('#controllertable').DataTable({
        paging:false,
        searching: false,
        info:false,
        ordering:false,
        ajax: {
            url: hostname+ '/get_controllers/' + current_airport,
            dataSrc: 'clients'
        },
        columns:[
            {data:"callsign"},
            //{data:"frequency"},
            {data:"name"}
        ],
        language: {
            "emptyTable": "No relevant controllers online"
        }
    })

    clientTable = $('#planetable').DataTable( {
        dom: '<"toolbar">Bfrtip',
        ajax: {
            url: hostname+ '/get_pilots/'+current_airport,
            dataSrc: 'clients'
        },
        columns:[
            {data: "type",
             render: function(data, type){
                if (data == 'A'){
                    return "<i class=\"fas fa-plane-arrival\"></i>"
                }else{
                    return  "<i class=\"fas fa-plane-departure\"></i>"
                }
             }
            },
            {data: "callsign"},
            {data: "arr_airport",
             render: function(data, type, row){
                if(row.flight_rule && row.flight_rule == 'V'){
                    if(row["callsign"] == "G10" || row["callsign"] == "G11" || row["callsign"] == "G12" || row["callsign"] == "G14" 
                    || row["callsign"] == "G15" || row["callsign"] == "G16" || row["callsign"] == "G17" || row["callsign"] == "G94"){
                        return "<img src=\"airline_icons/police.png\" />"
                    }else{
                        return "<img src=\"airline_icons/VFRlogo.png\" />"
                    }
                }else{
                    return "<img src=\"airline_icons/"+ row["callsign"].substring(0, 3) + ".png\" onError=\"this.src='airline_icons/unknown.png';\" />"
                }
             }
            },
            {data: "dep_airport",
             render: function(data,type,row){
                if(row["type"] == "A"){
                    return "<span title=\"" + row.dep_airport.detailed  + "\">"+ row.dep_airport.icao + "</span>"
                }else{
                    if(row.arr_airport){
                        return "<span title=\"" + row.arr_airport.detailed  + "\">"+ row.arr_airport.icao + "</span>"
                    }else{
                        return "<span title=\"TO BE ANNOUNCED\">TBA</span>"
                    }
                }
             }
            },
            {data: "aircraft",
             render: function(data,type,row){
                if(row.aircraft)
                    return "<span title=\"" + row.aircraft.detailed  + "\">"+ row.aircraft.icao + "</span>"
                else
                    return "<span title=\"TO BE ANNOUNCED\">TBA</span>"
             }
            },
            {data: "status",
             render: function(data, type, row){
                 switch(data){
                    case "at_gate":
                    case "at_gate_unfilled":
                        return "<b>AT GATE</b>"
                    case "arriving":
                        return "ARRIVING " + (row.miles_out != "" ? ("(" + row.eta + " min)") : "")
                    case "taxing":
                        if (row.type == "D")
                            return "TAXIING OUT"
                        else
                            return "TAXIING IN"
                 }
                
             }},
            {data: "assigned_gate",
            render: function(data,type, row){
                return (row.assigned_gate == '' ? '': "<b>" + row.assigned_gate + "</b>")
            }
        }
        ],
        select: {
            style: 'single',
        },
        buttons: [
            {
                text: 'refresh',
                className: 'btn btn-primary',
                action: update_all
            },
        ],
        language: {
            "emptyTable": "No inbound/outbound airplanes"
        }
    } );
    var date = new Date();
    $("div.toolbar").html('<b>Last updated: ' + date.toTimeString() + '</b>');

    /* Create map */
    map = L.map('mapid', {
        center: airport_coordinates[current_airport],
        zoom: 15,
        preferCanvas: true,
        scrollWheelZoom: false
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    $.getJSON(hostname + "/gates/" + current_airport, function (data) {
        $.each(data, function(key, entry){
            var circle = L.circle([entry.latitude, entry.longitude], {
                color: entry.occupied ? 'red' : '#00C400',
                //fillColor: '#f03',
                fillOpacity: 0.5,
                radius: 15
            }).addTo(map);
            all_circles[entry.gate] = circle
        });
    });
    update_map();
});


const update_map = () =>{
    /* Draw stands on map*/
    $.getJSON(hostname + "/gates/" + current_airport, function (data) {
        $.each(data, function(key, entry){
            if (entry.gate in all_circles){
                all_circles[entry.gate].setStyle({color: entry.occupied?'red':'#00C400'})
                let extra_information = ""
                if(entry.airport == "EBBR"){
                    if(entry.apron == "apron-9"){
                        extra_information = "Cargo only"
                    } else if(entry.apron == "apron-60"){
                        extra_information = "Overflow Cargo"
                    } else if(entry.apron == "apron-1-north-low-cost"){
                        extra_information = "Schengen low-cost only"
                    } else if(entry.apron == "apron-1-north" || entry.apron == "apron-1-south"){
                        extra_information = "Schengen only"
                    } else if(entry.apron == "apron-2-north" || entry.apron == "apron-2-south"){
                        extra_information = "Non-schengen only"
                    } else if(entry.apron == "apron-MIL"){
                        extra_information = "Military apron"
                    } else if(entry.apron == "apron-3-north" || entry.apron == "apron-3-south"|| entry.apron == "apron-4"){
                        extra_information = "Overflow / long-term"
                    }else if(entry.apron == "apron-GA"){
                        extra_information = "General aviation"
                    }else if(entry.apron == "apron-51c"){
                        extra_information = "Private jets"
                    }
                }else if(entry.airport == "ELLX"){
                    if(entry.apron == "apron-P7-Z" || entry.apron == "apron-P10-Z"){
                        extra_information = "Cargo only"
                    }else if(entry.apron == "apron-P2"){
                        extra_information = "Private jet"
                    }else if(entry.apron == "apron-P5"){
                        extra_information = "General aviation"
                    }else if(entry.apron == "apron-P1-V-heavy"){
                        extra_information = "Heavy aircrafts"
                    }else if(entry.apron == "apron-P1-B"){
                        extra_information = "Turboprop/Regional schengen"
                    }else if(entry.apron == "apron-P1-V-nonshengen"){
                        extra_information = "Turboprop/Regional non-schengen"
                    }else if(entry.apron == "apron-P1-V"){
                        extra_information = "Low-cost"
                    }else if(entry.apron == "apron-P1-A"){
                        extra_information = "Non-schengen only"
                    }else if(entry.apron == "apron-P1-A-nonshengen"){
                        extra_information = "Non-schengen only"
                    }else if(entry.apron == "apron-P8"){
                        extra_information = "Cargolux maintenance"
                    }
                }else if(entry.airport == "EBCI"){
                    if(entry.apron == "apron-P1" || entry.apron == "apron-P2" || entry.apron == "apron-P3" || entry.apron == "apron-P4"){
                        extra_information = "General aviation"
                    }else if(entry.apron == "apron-P5"){
                        extra_information = "Cargo only"
                    }else if(entry.apron == "apron-P10-heavy"){
                        extra_information = "Commercial heavy aircrafts"
                    }else if(entry.apron == "apron-P5"){
                        extra_information = "Turboprop / Private jets"
                    }else{
                        extra_information = "Commercial"
                    }

                }else if(entry.airport == "EBLG"){
                    if(entry.apron == "apron-north"){
                        extra_information = "Heavy cargo"
                    }else if(entry.apron == "apron-P2" || entry.apron == "apron-P3"){
                        extra_information = "Cargo only"
                    }else if(entry.apron == "apron-P1"){
                        extra_information = "Commercial"
                    }else if(entry.apron == "apron-north-new"){
                        extra_information = "New stand / not in use"
                    }

                }else if(entry.airport == "EBAW"){
                    if(entry.apron == "apron-GA" || entry.apron == "apron-north"){
                        extra_information = "General aviation"
                    }else if(entry.apron == "apron-2"){
                        extra_information = "Private jets"
                    }else if(entry.apron == "apron-1"){
                        extra_information = "Commercial"
                    }else if(entry.apron == "apron-Heli"){
                        extra_information = "Helicopters"
                    }

                }else if(entry.airport == "EBOS"){
                    if(entry.apron == "apron-3"){
                        extra_information = "General aviation"
                    }else if(entry.apron == "apron-2-cargo" || entry.apron == "apron-1"){
                        extra_information = "Cargo only"
                    }else if(entry.apron == "apron-2"){
                        extra_information = "Commercial"
                    }else if(entry.apron == "apron-2-cargo-overflow"){
                        extra_information = "Cargo overflow"
                    }else if(entry.apron == "apron-2-overflow"){
                        extra_information = "Commercial overflow"
                    }

                }
                let popupMessage = "Stand " + entry.gate 
                                    + (extra_information?"<br>"+ extra_information : "")
                                    + (entry.occupied?"<br><b>" + entry.assigned_to + "</b>" : "")

                all_circles[entry.gate].bindPopup(popupMessage);
            }
        });
    });
}