logging = require('./logging.js')
mqtt = require('mqtt')

publish_map = {}

exports.publish = function(client, topic, message) {
    if (client === null || topic === null) {
        logging.warn("empty client or topic passed into mqtt_helpers.publish")
        return
    }

    logging.log(" " + topic + ":" + message)
    if (publish_map[topic] !== message) {
        publish_map[topic] = message
        logging.log(" => published!")
        client.publish(topic, message)
    } else {
        logging.log(" * not published")
    }
}