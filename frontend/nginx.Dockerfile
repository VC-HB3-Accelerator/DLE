FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx-tunnel.conf /etc/nginx/conf.d/default.conf