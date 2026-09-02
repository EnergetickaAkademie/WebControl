# Mosquitto deployment files

The real `passwd` and `acl` files are intentionally not stored in Git. Before
starting either Compose configuration, generate them on the deployment host:

```sh
python3 scripts/generate_mqtt_auth.py \
  --users config/users.toml \
  --password-file mosquitto/passwd \
  --acl-file mosquitto/acl
```

The generator rejects unsafe, weak, or reused board passwords. Keep the output
files mode `0600` and rotate them as deployment secrets. Local debug runs can
set `MQTT_ENABLED=false` and `MQTT_V3_ENABLED=false` while the broker is being
provisioned.

Production Nginx also expects `tls/fullchain.pem` and `tls/privkey.pem`, which
are deployment secrets and are not included here. Debug Compose intentionally
remains local HTTP/WS.
