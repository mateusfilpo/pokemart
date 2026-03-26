FROM nginx:stable-alpine

# Atualiza pacotes do Alpine para corrigir CVEs com fix disponível (ex: CVE-2026-22184 / zlib)
RUN apk upgrade --no-cache

RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/nginx.conf

COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]