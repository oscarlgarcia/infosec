FROM node:20-bookworm AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

RUN rm -f /etc/nginx/conf.d/default.conf

RUN cat > /etc/nginx/conf.d/default.conf << 'ENDOFFILE'
types {
    text/html html htm shtml;
    text/css css;
    text/javascript js;
    application/javascript js;
    application/json json;
    image/png png;
    image/jpeg jpg jpeg;
    image/gif gif;
    image/svg+xml svg svgz;
    image/x-icon ico;
    font/woff woff;
    font/woff2 woff2;
}

server {
    listen 80;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Disable all caching
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    add_header Pragma "no-cache";
    add_header Expires "0";
    add_header X-Frame-Options "SAMEORIGIN";
    
    location / {
        try_files $uri /index.html;
    }
    
    location /uploads/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
ENDOFFILE

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
