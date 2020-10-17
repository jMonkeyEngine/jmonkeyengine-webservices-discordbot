# JME Discord Bot

A  bot that notifies about health status and email.

## Build
```console
docker build -t jme-discordbot .
```


## Run
```console
docker run \
-d \
--restart=always \
--name="jme-discordbot" \
--read-only \
-v $PWD/config.json:/app/config.json:ro \
--tmpfs /tmp \
 jme-discordbot
```