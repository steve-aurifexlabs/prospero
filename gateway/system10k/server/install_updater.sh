# Add cron entry

#crontab -e
#SHELL=/bin/bash
#PATH=/sbin:/bin:/usr/sbin:/usr/bin

#17 * * * * /root/system10k/server/run_system_updates.sh >> /var/log/system_update.log 2>&1



# Create update script

# nano system10k/server/run_system_updates.sh
# apt update
# apt upgrade -y
# apt reboot



# Set exec permissions for script

#chmod +x system10k/server/run_system_updates.sh



# Add server auto-start on system restart

#pm2 startup
#pm2 save
