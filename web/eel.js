// eel.js - v0.14.0
(function () {
    var eel = {};

    var DEBUG = false;

    var base_url = '';
    var default_timeout = 10000;  // ms
    var call_number = 0;

    var calls = {};
    var exposed_functions = [];

    var when_ready_funcs = [];

    var websocket;

    eel.set_host = function (hostname) {
        base_url = '//' + hostname;
    }

    eel.set_port = function (port) {
        base_url = base_url + ':' + port;
    }

    eel.expose = function (f, name) {
        exposed_functions.push([f, name]);
    }

    function _import_py_function(name) {
        var parts = name.split(".");
        var obj = window;
        for (var i = 0; i < parts.length; i++) {
            obj = obj[parts[i]];
        }
        return obj
    }

    function _import_js_function(name) {
        var parts = name.split(".");
        var obj = window;
        for (var i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
        }
        return obj[parts[parts.length - 1]]
    }

    function _import(name) {
        var parts = name.split(".");
        var obj = window;
        for (var i = 0; i < parts.length; i++) {
            obj = obj[parts[i]];
        }
        return obj
    }

    eel._call_return_callbacks = {};

    eel._call = function (path, args) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', base_url + path + '?call=' + call_number.toString(), true);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                if (xhr.status == 200) {
                    var result = JSON.parse(xhr.responseText);
                    if ('call' in result) {
                        var return_callbacks = eel._call_return_callbacks[result['call']];
                        delete eel._call_return_callbacks[result['call']];
                        return_callbacks(result['value'][0], result['value'][1]);
                    } else {
                        console.warn('Invalid message received', result);
                    }
                } else {
                    var callbacks = calls[call_number.toString()];
                    if (callbacks && 'reject' in callbacks) {
                        callbacks['reject'](xhr.responseText);
                    }
                }
            }
        }
        xhr.send(JSON.stringify(args));
        call_number += 1;

        var promise = new Promise(function (resolve, reject) {
            calls[call_number.toString()] = { 'resolve': resolve, 'reject': reject };
        });
        return promise;
    }

    function _call_return(call_id, status, value) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', base_url + '/__return/' + call_id, true);
        xhr.send(JSON.stringify({ 'status': status, 'value': value }));
    }

    function _import_py_functions(names) {
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var parts = name.split(".");
            var obj = window;
            for (var j = 0; j < parts.length - 1; j++) {
                obj = obj[parts[j]];
            }
            obj[parts[parts.length - 1]] = _import_py_function(name);
        }
    }

    function _import_js_functions(names) {
        for (var i = 0; i < names.length; i++) {
            var name = names[i];
            var parts = name.split(".");
            var obj = window;
            for (var j = 0; j < parts.length - 1; j++) {
                obj = obj[parts[j]];
            }
            obj[parts[parts.length - 1]] = _import_js_function(name);
        }
    }

    eel._init = function () {
        document.addEventListener("DOMContentLoaded", function (event) {
            if (DEBUG) {
                console.log("eel: initalizing");
            }

            for (var i = 0; i < exposed_functions.length; i++) {
                var func = exposed_functions[i][0];
                var name = exposed_functions[i][1];

                if (DEBUG) {
                    console.log('func', func);
                    console.log('name', name);
                }

                window[name] = func;
            }

            for (var i = 0; i < when_ready_funcs.length; i++) {
                when_ready_funcs[i]();
            }
        });

        websocket = new WebSocket('ws://' + document.location.host + '/eel');
        websocket.onopen = function (event) {
            if (DEBUG) {
                console.log("eel: websocket open");
            }
        }
        websocket.onclose = function (event) {
            if (DEBUG) {
                console.log("eel: websocket closed");
            }
        }
        websocket.onerror = function (event) {
            if (DEBUG) {
                console.log("eel: websocket error", event);
            }
        }
        websocket.onmessage = function (event) {
            if (DEBUG) {
                console.log("eel: websocket message", event.data);
            }
            var message = JSON.parse(event.data);
            if ('call' in message) {
                var name = message['name'];
                var args = message['args'];

                var func = _import(name);
                if (func == undefined) {
                    console.warn('Unknown function', name);
                    return;
                }

                if (DEBUG) {
                    console.log('eel: calling', name, args);
                }

                try {
                    var return_val = func.apply(null, args);
                    _call_return(message['call'], 'ok', return_val);
                } catch (error) {
                    console.error('Exception thrown in Python', error);
                    _call_return(message['call'], 'error', error.toString());
                }
            } else if ('return' in message) {
                var call_id = message['return'];
                var status = message['status'];
                var value = message['value'];

                if (DEBUG) {
                    console.log('eel: return', call_id, status, value);
                }

                var callbacks = calls[call_id.toString()];
                delete calls[call_id.toString()];

                if (status == 'ok') {
                    callbacks['resolve'](value);
                } else if (status == 'error') {
                    callbacks['reject'](value);
                }
            }
        }
    }

    window.eel = eel;

    // Expose Eel to Python
    if (typeof window.eel.expose_functions === 'undefined') {
        window.eel.expose_functions = [];
    }
    window.eel.expose_functions.push(_import_py_functions);
    window.eel.expose_functions.push(_import_js_functions);

    // Expose Eel to JavaScript
    if (typeof window.expose_functions === 'undefined') {
        window.expose_functions = [];
    }
    window.expose_functions.push(_import_py_functions);
    window.expose_functions.push(_import_js_functions);
})();