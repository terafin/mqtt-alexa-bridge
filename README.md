# mqtt-alexa-bridge

## Environment Variables

```
MQTT_HOST = "mqtt://mosquitto"
CONFIG_PATH = "/config/path/alexa/"
LISTENING_PORT = "3000"
ALEXA_EMAIL = "youramazonaccount@somewhere.com"
ACCESS_TOKEN_URL = "https://api.amazon.com/user/profile?access_token="
```

## Setup

1 Configure an Alexa Smart Home skill and use "Login with Amazon" for your account linking. See here & here
2. Although it will work without it, for security, I HIGHLY recommend using SSL between your lambda skill adapter in step 3 below and node-red. If running node-red on a home server this would normally entail setting up dynamic DNS (desec.io is free and works well) and using LetsEncrypt to set up a certificate for your domain.
3. Use the following python skill adapter in your Amazon lambda instance, and be sure to insert your node-red url endpoint in url = 'https://my_url/smarthome'. Credit to JonW who posted this skill adapter here which I only slightly modified.

```

"""
--------------------  REFERENCE MATERIALS  --------------------
Smart Home Skill API Reference:
https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit/docs/smart-home-skill-api-reference
Python reference for url/http handling
https://docs.python.org/2/howto/urllib2.html
---------------------------------------------------------------
"""
import json
import urllib
import urllib2
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ============================================================================
#   Default Handler for all function requests
# ============================================================================
def lambda_handler(event, context):

    # Set the request URL to host:port.
    url = 'https://my_url/smarthome'

    # Encode the request event data.
    data = json.dumps(event)

    # Perform the request with the event data.
    req = urllib2.Request(url, data)
    req.add_header('Content-Type' , 'application/json')


    # Create the response object.
    response = urllib2.urlopen(req)

    # Get the complete response page.
    the_page = str(response.read())

    # Load raw page data into JSON object.
    parsed_json = json.loads(the_page)

    # Log the event request, page response and json object.
    #logger.info('**  Context Request  ** = {}'.format(context))
    logger.info('**  Event Request  ** = {}'.format(event))
    logger.info('**  Page Response  ** = {}'.format(the_page))
    logger.info('**  Parsed JSON  ** = {}'.format(parsed_json))

    # Return value as a JSON object.
    return parsed_json

```



1. Set up port forwarding on your firewall to accept and forward to the right internal host running node-red on your network
2. Paste in the node-red flow below and change e-mail address in the "verify email" node to your e-mail address associated with your linked Amazon account.
3. In the Alexa mobile app, link your smart home skill with your Amazon account.
4. In the Alexa mobile app, hit Discover Devices. If everything worked, you should see 2 new devices discovered: Test Light & Test Thermostat.
5. You're done! Say "Alexa, turn on test light", and you should see a message in node red debug tab.