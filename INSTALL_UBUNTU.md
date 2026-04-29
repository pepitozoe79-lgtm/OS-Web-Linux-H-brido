# 🐧 Guía de Instalación en Ubuntu Server

Esta guía detalla cómo desplegar **OS-Web-Linux-Híbrido** en un servidor Ubuntu (probado en Ubuntu 22.04/24.04).

## 🚀 Instalación Rápida (Script Automático)

Si ya clonaste el repositorio, simplemente ejecuta el script de instalación:

```bash
chmod +x install.sh
./install.sh
```

El script se encargará de:
1. Instalar Node.js (v20+), Nginx y Git.
2. Instalar las dependencias de `npm`.
3. Compilar el proyecto (`npm run build`).
4. Configurar Nginx para servir el sitio en la IP de tu servidor.
5. Ajustar los permisos necesarios.

---

## 🛠️ Instalación Manual

Si prefieres hacerlo paso a paso:

### 1. Requisitos Previos
```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx
```

### 2. Preparar el Proyecto
```bash
npm install
# IMPORTANTE: Borrar el archivo obsoleto para evitar errores de compilación
rm src/hooks/useFileSystem.ts 
npx vite build
```

### 3. Configurar el Servidor Web (Nginx)
Crea un archivo en `/etc/nginx/sites-available/weblinux`:

```nginx
server {
    listen 80;
    server_name TU_IP_DEL_SERVIDOR;

    location / {
        root /ruta/al/proyecto/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

Luego activa el sitio y reinicia:
```bash
sudo ln -s /etc/nginx/sites-available/weblinux /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
```

### 🔒 Permisos de Carpeta Home
Por defecto, Ubuntu bloquea el acceso de Nginx a las carpetas `/home/usuario`. Debes habilitarlo:
```bash
chmod 755 /home/tu_usuario
```

---
**Desarrollado con ❤️ para la comunidad de Open Source.**
