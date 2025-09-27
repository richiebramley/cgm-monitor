# Railway Deployment Guide for Nightscout CGM Monitor

## 🚨 Critical Issue Identified

Your Railway deployment is failing because **required environment variables are missing**. The application cannot start without these mandatory settings.

## Required Environment Variables

### 1. Database Connection (MANDATORY)
You need a MongoDB database. Set one of these environment variables in Railway:

```bash
MONGODB_URI=mongodb://username:password@host:port/database
```

**Alternative names that also work:**
- `STORAGE_URI`
- `MONGO_CONNECTION`
- `MONGO`
- `MONGOLAB_URI`

### 2. API Secret (MANDATORY)
Set a secure API secret for authentication:

```bash
API_SECRET=your-secure-api-secret-here-minimum-12-characters
```

**Requirements:**
- Minimum 12 characters
- Mix of letters, numbers, and special characters
- Example: `MySecureAPI123!@#`

## How to Fix Your Railway Deployment

### Step 1: Add Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your Nightscout service
3. Go to the **Variables** tab
4. Add these environment variables:

```
MONGODB_URI=mongodb://your-connection-string
API_SECRET=your-secure-secret-here
```

### Step 2: Get a MongoDB Database

#### Option A: MongoDB Atlas (Recommended - Free)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account
3. Create a new cluster
4. Get your connection string
5. Replace `<password>` with your database password
6. Replace `<dbname>` with `nightscout` or your preferred database name

Example connection string:
```
mongodb+srv://username:password@cluster.mongodb.net/nightscout?retryWrites=true&w=majority
```

#### Option B: Railway MongoDB Add-on
1. In your Railway project
2. Click **+ New**
3. Select **Database** → **MongoDB**
4. Railway will automatically set the `MONGODB_URI` variable

### Step 3: Redeploy

After adding the environment variables:
1. Railway will automatically redeploy your application
2. Check the **Deploy Logs** to see the startup process
3. Your application should now start successfully

## Optional Environment Variables

```bash
# Display settings
DISPLAY_UNITS=mg/dl  # or "mmol"

# Security settings
INSECURE_USE_HTTP=false
SECURE_HSTS_HEADER=true

# Port (Railway sets this automatically)
PORT=1337

# Hostname (Railway sets this automatically)  
HOSTNAME=0.0.0.0
```

## Verification Steps

### 1. Check Deployment Logs
Look for these messages in Railway deploy logs:
```
Executing startBoot
Executing checkNodeVersion
Node LTS version v24.4.1 is supported
Executing checkEnv
Executing checkSettings
Checking settings
Executing setupStorage
Mongo Storage system ready
```

### 2. Health Check
Visit your Railway URL + `/api/status` to verify the application is running.

### 3. Main Application
Visit your Railway URL to see the Nightscout interface.

## Troubleshooting

### Error: "MONGODB_URI setting is missing"
- Add the `MONGODB_URI` environment variable in Railway
- Ensure the connection string is valid

### Error: "API_SECRET setting is missing"  
- Add the `API_SECRET` environment variable in Railway
- Ensure it's at least 12 characters long

### Error: "Cannot connect to database"
- Verify your MongoDB connection string is correct
- Check if your MongoDB cluster allows connections from Railway's IP ranges
- For MongoDB Atlas, ensure your IP whitelist includes `0.0.0.0/0` (all IPs)

### Application starts but shows errors
- Check Railway deploy logs for specific error messages
- Verify all environment variables are set correctly

## Security Recommendations

1. **Use a strong API_SECRET**: Mix of letters, numbers, and special characters
2. **Secure your database**: Use MongoDB Atlas with proper authentication
3. **Enable HTTPS**: Railway provides this automatically
4. **Regular updates**: Keep your Nightscout installation updated

## Support

If you continue to have issues:
1. Check Railway deploy logs for specific error messages
2. Verify all environment variables are set
3. Test your MongoDB connection string independently
4. Review the [Nightscout documentation](https://nightscout.github.io/nightscout/)

---

**Note:** This deployment guide assumes you're using the latest version of Nightscout with Node.js v24 support that we just fixed.
