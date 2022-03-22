# Prospero

Live at https://prosperodev.live

## Dependencies

- Ubuntu 20.04
- nginx
- node v14.x 
- certbot

## To Use

This process is not tested. Just off the top of my head.

### Installation

- Spin up an Ubuntu 20.04 cloud instance with at least 1GB ram
- Install nginx, node, npm, certbot

- Update domains in main/system10k/server/nginx
- Symlink /etc/nginx/sites-enabled/default -> main/system10k/server/nginx
- Set up SSL certs with certbot

- Install zip: apt install zip
- Install npm packages
- Install pm2

- Add environment vars to /etc/environment

POSTMARK_KEY="<postmark-key>"
PGUSER="postgres"
PGPASSWORD="<postgres-password>"
STORAGE_PATH="<storage-path>"

- Run: mkdir $STORAGE_PATH/data
- Run: echo "{}" > $STORAGE_PATH/data/sessions.json
- Run: mkdir $STORAGE_PATH/data/storage

- Run: cd main/system10k
- Run: pm2 start server/server.js

- Run: cd gateway/system10k
- Run: pm2 start server/bridge.js

- Run: cd app/system10k
- Run: pm2 start server/multi-process-gate.js

