const logging = require('./logging.js')
const mqtt = require('mqtt')

var publish_map = {}

function fix_name(str) {
    str = str.replace(/[+\\\&\*\%\$\#\@\!]/g, '')
    str = str.replace(/\s/g, '_').trim().toLowerCase()
    str = str.replace(/__/g, '_')
    return str
}

if (mqtt.MqttClient.prototype.smartPublish == null) mqtt.MqttClient.prototype.smartPublish = function(topic, message) {
    if (topic === null) {
        logging.error('empty client or topic passed into mqtt_helpers.publish')
        return
    }
    topic = fix_name(topic)

    logging.info(' ' + topic + ':' + message)
    if (publish_map[topic] !== message) {
        publish_map[topic] = message
        logging.debug(' => published!')
        this.publish(topic, message)
    } else {
        logging.debug(' * not published')
    }
}