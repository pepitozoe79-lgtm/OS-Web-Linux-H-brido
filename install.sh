#!/bin/bash

# --- OS-Web-Linux-Híbrido: Auto Installer for Ubuntu Server ---
# Created for: Marco
# Date: 2026-04-28

PROJECT_NAME="OS-Web-Linux-H-brido"
INSTALL_DIR=$(pwd)
MI_IP=$(hostname -I | awk '{print $1}')

echo "🚀 Iniciando instalación automática de Web-Linux en $MI_IP..."

# 1. Dependencias del sistema
echo "📦 Instalando dependencias (Git, Nginx, Node)..."
sudo apt update && sudo apt install -y git nginx curl
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 2. Instalación de paquetes de Node
echo "npm install..."
npm install

# 3. Parche de compatibilidad
echo "🔧 Limpiando archivos obsoletos..."
rm -f src/hooks/useFileSystem.ts 

# 4. Compilación
echo "🏗️ Construyendo el proyecto con Vite..."
npx vite build

# 5. Configuración de Nginx
echo "🌐 Configurando servidor web Nginx..."
sudo bash -c "cat > /etc/nginx/sites-available/weblinux <<EOF
server {
    listen 80;
    server_name $MI_IP;

    location / {
        root $INSTALL_DIR/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF"

# 6. Activación y Permisos
echo "🔒 Ajustando permisos y reiniciando Nginx..."
sudo ln -sf /etc/nginx/sites-available/weblinux /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
chmod 755 $(dirname "$INSTALL_DIR")
chmod -R 755 "$INSTALL_DIR/dist"
sudo systemctl restart nginx

echo "------------------------------------------------"
echo "✅ ¡INSTALACIÓN COMPLETADA EXITOSAMENTE!"
echo "🌍 Accede desde tu red en: http://$MI_IP"
echo "------------------------------------------------"
