#!/bin/bash

# =================================================================
# 💠 OS-Web-Linux-Híbrido: Instalador Automático (v1.1)
# =================================================================
# Despliega este Sistema Operativo Web en un servidor Ubuntu
# de forma rápida y profesional.
# =================================================================

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sin color

# Variables de entorno
PROJECT_NAME="OS-Web-Linux-H-brido"
INSTALL_DIR=$(pwd)
MI_IP=$(hostname -I | awk '{print $1}')

echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}    🚀 INICIANDO INSTALACIÓN DE WEB-LINUX${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Comprobar permisos
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Este script debe ejecutarse como ROOT (usa sudo).${NC}"
   exit 1
fi

# 2. Actualizar sistema e instalar dependencias
echo -e "\n${YELLOW}📦 [1/6] Instalando dependencias del sistema...${NC}"
apt update && apt install -y git nginx curl
if ! command -v node &> /dev/null; then
    echo -e "${BLUE}📥 Instalando Node.js v20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# 3. Preparar el proyecto
echo -e "\n${YELLOW}🛠️ [2/6] Instalando paquetes de Node...${NC}"
npm install --quiet

# 4. Parches de compatibilidad
echo -e "\n${YELLOW}🔧 [3/6] Aplicando optimizaciones de código...${NC}"
# Borramos archivos que causan conflictos en el build
rm -f src/hooks/useFileSystem.ts 
echo "✅ Archivos obsoletos eliminados."

# 5. Compilación
echo -e "\n${YELLOW}🏗️ [4/6] Compilando aplicación con Vite...${NC}"
npx vite build

# 6. Configuración de Nginx
echo -e "\n${YELLOW}🌐 [5/6] Configurando servidor web Nginx...${NC}"
bash -c "cat > /etc/nginx/sites-available/weblinux <<EOF
server {
    listen 80;
    server_name $MI_IP;
    root $INSTALL_DIR/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html =404;
    }

    # Desactivar redirecciones absolutas para evitar bucles
    absolute_redirect off;
}
EOF"

# 7. Activación, Permisos y Limpieza
echo -e "\n${YELLOW}🔒 [6/6] Ajustando permisos finales...${NC}"
ln -sf /etc/nginx/sites-available/weblinux /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Dar permisos de lectura a Nginx sobre la carpeta home si es necesario
chmod 755 $(dirname "$INSTALL_DIR")
chmod -R 755 "$INSTALL_DIR/dist"

systemctl restart nginx

echo -e "\n${BLUE}====================================================${NC}"
echo -e "${GREEN}    ✅ ¡INSTALACIÓN COMPLETADA CON ÉXITO!${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "🌍 Accede desde cualquier equipo en:"
echo -e "${YELLOW}👉 http://$MI_IP${NC}"
echo -e "${BLUE}====================================================${NC}\n"
