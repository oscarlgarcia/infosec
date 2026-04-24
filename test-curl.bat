@echo off
curl -s -I http://localhost:5174/ | findstr "HTTP"
curl -s -I http://localhost:5174/assets/index-DalEiq_R.css | findstr "HTTP"