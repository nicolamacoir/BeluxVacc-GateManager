'use strict';

module.exports = function(app) {
    var belux = require('../controllers/beluxController');

    app.route('/gates')
    .get(belux.list_all_gates)

    app.route('/gates/:airport')
    .get(belux.list_all_gates_for_airport)
    .post(belux.list_all_valid_gates)

    app.route('/get_gate/')
    .post(belux.get_gate_for_callsign)

    app.route('/get_gate/:airport/:gateid')
    .get(belux.get_gate_for_id)

    app.route('/request_gate')
    .post(belux.request_gate)

    app.route('/change_gate')
    .post(belux.change_gate)

    app.route('/toggle_reservation/:airport/:gateid')
    .post(belux.toggle_reservation)

    app.route('/get_pilots/:airport')
    .get(belux.get_active_pilots)

    app.route('/get_controllers')
    .get(belux.get_active_controllers)

    app.route('/force_get_clients')
    .get(belux.force_reload_clients)

    app.route("/available_airports")
    .get(belux.get_available_airports)
};