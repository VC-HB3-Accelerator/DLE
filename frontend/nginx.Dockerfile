FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx-simple.conf /etc/nginx/nginx.conf