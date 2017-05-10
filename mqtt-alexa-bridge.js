// Requirements
const mqtt = require('mqtt')
const express = require('express')
const async = require('async')
const request = require('request')
const bodyParser = require('body-parser')
const config = require('./homeautomation-js-lib/config_loading.js')
const logging = require('./homeautomation-js-lib/logging.js')
const _ = require('lodash')

require('./homeautomation-js-lib/mqtt_helpers.js')

// Config
const listening_port = process.env.LISTENING_PORT
const alexaEmail = process.env.ALEXA_EMAIL
const configPath = process.env.CONFIG_PATH
const accessTokenURL = process.env.ACCESS_TOKEN_URL

if (_.isNil(configPath)) {
    logging.warn('CONFIG_PATH not set, not starting')
    process.abort()
}

if (_.isNil(accessTokenURL)) {
    logging.warn('ACCESS_TOKEN_URL not set, not starting')
    process.abort()
}

if (_.isNil(listening_port)) {
    logging.warn('LISTENING_PORT not set, not starting')
    process.abort()
}

if (_.isNil(alexaEmail)) {
    logging.warn('ALEXA_EMAIL not set, not starting')
    process.abort()
}

var client = mqtt.setupClient()

config.load_path(configPath)

var devicesConfig = []

config.on('config-loaded', () => {
    logging.debug('  Alexa config loaded')
    devicesConfig = []

    config.deviceIterator(function(deviceName, deviceConfig) {
        var deviceInfo = {
            name: deviceName,
            spoken_name: deviceConfig.name,
            actions: deviceConfig.actions,
            topic: deviceConfig.topic
        }
        devicesConfig.push(deviceInfo)
        logging.debug('  found device info', deviceInfo)
    })
})

function generateDeviceDiscoveryPayload() {
    var deviceInfo = []

    devicesConfig.forEach(function(device) {
        deviceInfo.push({
            'actions': [
                'turnOn',
                'turnOff'
            ],
            'additionalApplianceDetails': {
                extraDetail1: 'optionalDetailForSkillAdapterToReferenceThisDevice'
            },
            'applianceId': device.name,
            'friendlyDescription': device.spoken_name,
            'friendlyName': device.spoken_name,
            'isReachable': true,
            'manufacturerName': 'AlexaMQTTBridge',
            'modelName': 'AlexaMQTTBridgeSwitch',
            'version': 'MQTTV1'
        })
    }, this)

    return deviceInfo
}

function deviceInfoForApplianceId(applianceId) {
    var foundDeviceInfo = null

    devicesConfig.forEach(function(device) {
        if (device.name == applianceId)
            foundDeviceInfo = device
    }, this)

    return foundDeviceInfo
}

var handleDiscoveryRequest = function(req, namespace, msgID) {
    var responseBody = {
        'header': {
            'messageId': msgID,
            'namespace': 'Alexa.ConnectedHome.Discovery',
            'name': 'DiscoverAppliancesResponse',
            'payloadVersion': '2'

        },
        'payload': { discoveredAppliances: generateDeviceDiscoveryPayload() }
    }
    return responseBody
}

var handleHealthCheckRequest = function(req, namespace, msgID) {
    var responseBody = {
        'header': {
            'messageId': msgID,
            'name': 'HealthCheckResponse',
            'namespace': 'Alexa.ConnectedHome.System',
            'payloadVersion': '2'
        },
        'payload': {
            'description': 'The system is currently healthy',
            'isHealthy': true
        }
    }
    return responseBody
}

var processAction = function(value, topic, callback) {
    if (!_.isNil(value) && !_.isNil(topic)) {
        client.publish(topic, '' + value)
        logging.info('alexa action', {
            'action': 'alexa-request',
            'topic': topic,
            'value': value,
        })
    }

    if (!_.isNil(callback))
        callback()
}

var handleControlRequest = function(req, namespace, msgID) {
    var controlRequest = req.body.header.name
    var controlResponse = null

    switch (controlRequest) {
        case 'TurnOnRequest':
            controlResponse = 'TurnOnConfirmation'
            break

        case 'TurnOffRequest':
            controlResponse = 'TurnOffConfirmation'
            break

        default:
            logging.error(' => Unhandled Control Request: ' + controlRequest, {
                event: 'unsupported request',
                control_request: controlRequest,
                applianceId: applianceId
            })
            return null
    }

    var applianceId = req.body.payload.appliance.applianceId

    logging.debug(' => Control Request: ' + controlRequest, {
        controlRequest: controlRequest,
        controlResponse: controlResponse,
        applianceId: applianceId
    })

    var foundDeviceInfo = deviceInfoForApplianceId(applianceId)

    if (_.isNil(foundDeviceInfo)) return null

    var responseBody = {
        'header': {
            'messageId': msgID,
            'name': controlResponse,
            'namespace': 'Alexa.ConnectedHome.Control',
            'payloadVersion': '2'
        },
        'payload': {}
    }

    const topic = foundDeviceInfo.topic
    const actions = foundDeviceInfo.actions

    switch (controlRequest) {
        case 'TurnOnRequest':
            if (!_.isNil(actions))
                async.eachOf(actions['on'], processAction)
            processAction('1', topic)

            break
        case 'TurnOffRequest':
            if (!_.isNil(actions))
                async.eachOf(actions['off'], processAction)
            processAction('0', topic)

            break
    }

    return responseBody
}

var processRequest = function(req) {
    const namespace = req.body.header.namespace
    const msgID = req.body.header.messageId
    logging.debug('namespace: ' + namespace)

    var responseBody = {}
    switch (namespace) {
        case 'Alexa.ConnectedHome.Discovery':
            logging.debug(' => Discovery')
            responseBody = handleDiscoveryRequest(req, namespace, msgID)
            break
        case 'Alexa.ConnectedHome.System':
            logging.debug(' => Health Ping')
            responseBody = handleHealthCheckRequest(req, namespace, msgID)
            break
        case 'Alexa.ConnectedHome.Control':
            logging.debug(' => Control Action')
            responseBody = handleControlRequest(req, namespace, msgID)
            break
        default:
            responseBody = {}
            logging.debug(' => ** Unhandled request')
            break

    }
    logging.debug('returning response body', responseBody)

    return responseBody
}



var completeRequest = function(req, res, accessURL) {
    const responseBody = processRequest(req)
    logging.info('alexa-action-complete: ' + accessURL, {
        action: 'alexa-action-complete',
        url: accessURL
    })
    res.send(responseBody)
}

// Web front end
var app = express()

app.use(bodyParser.json())

var cachedAccessToken = null

app.post('/alexa/*', function(req, res) {
    // First verify our access token
    logging.debug('request body: ' + JSON.stringify(req.body.payload))
    var accessToken = req.body.payload.accessToken
    logging.debug('accessToken: ' + accessToken)

    const accessURL = accessTokenURL + accessToken

    if (!_.isNil(cachedAccessToken) && cachedAccessToken === accessToken) {
        logging.debug('cached request: ' + accessToken)
        completeRequest(req, res, 'cached')
    } else {
        request.get({ url: accessURL, json: true }, function(error, response, body) {
            var statusCode = 401

            if (!_.isNil(response) && !_.isNil(response.statusCode)) {
                statusCode = response.statusCode
            }
            if (statusCode !== 200 && !_.isNil(response) || !_.isNil(error)) {
                cachedAccessToken = null
                logging.error('alexa action failed: ' + accessURL, {
                    event: 'access-token-verify-failed',
                    error: error,
                    code: (response && response.statusCode ? response.statusCode : 'none'),
                    body: body,
                    url: accessURL
                })
            }
            const discoveredEmail = body.email
            if (discoveredEmail === alexaEmail) {
                logging.debug('Email passed')
                cachedAccessToken = accessToken
                logging.debug('   => Caching token: ' + accessToken)
            } else {
                logging.debug('*** Email does not match, failing ***')
                cachedAccessToken = null
                res.status(401)
                return
            }

            completeRequest(req, res, accessURL)
        })
    }
})

app.listen(listening_port, function() {
    logging.info('Alexa-MQTT Bridge listening on port: ', listening_port)
})