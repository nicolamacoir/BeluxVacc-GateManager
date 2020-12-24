'use strict';

module.exports = function(app) {
    var belux = require('../controllers/beluxController');

    app.route('/gates')
    .get(belux.list_all_gates)
    .post(belux.list_all_valid_gates)

    app.route('/get_gate/')
    .post(belux.get_gate_for_callsign)

    app.route('/get_gate_for_plugin/')
    .post(belux.get_gate_for_callsign_for_plugin)

    app.route('/get_gate/:gateid')
    .get(belux.get_gate_for_id)

    app.route('/request_gate')
    .post(belux.request_gate)

    app.route('/change_gate')
    .post(belux.change_gate)

    app.route('/toggle_reservation/:gateid')
    .post(belux.toggle_reservation)

    app.route('/get_clients')
    .get(belux.get_active_clients)

    app.route('/force_get_clients')
    .get(belux.force_reload_clients)
};