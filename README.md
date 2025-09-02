# COP Conference Lecture - Student Server Infrastructure

This project uses Pulumi to provision AWS EC2 instances for educational purposes, automatically creating student user accounts with comprehensive logging via CloudWatch.

## 🎯 Features

- **Multi-Stack Support**: Separate configurations for different classes (class-a, class-b...)
- **Automated Student Account Creation**: Creates Linux users with password authentication
- **SSH Key Management**: Uses your local SSH public key for access
- **Real-time Logging**: All student shell activity logged to CloudWatch
- **Security Group Configuration**: SSH access with proper firewall rules
- **CloudWatch Integration**: Centralized log monitoring and retention

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v14 or later)
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- AWS CLI configured with appropriate credentials

## 🚀 Quick Start

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Configure AWS credentials:**

   ```bash
   aws configure
   ```

3. **Select a stack (class):**

   ```bash
   # For class-a
   pulumi stack select class-a

   # For class-b
   pulumi stack select class-b
   ```

4. **Configure students (optional):**

   Each stack is configured with specific students in the respective `Pulumi.<stack>.yaml` files. To modify students, edit the appropriate configuration file:

   ```yaml
   config:
     aws:region: us-east-1
     cop-conference-lecture:students: '[ "student1", "student2", "student3" ]'
   ```

5. **Deploy the infrastructure:**

   ```bash
   pulumi up
   ```

6. **Get connection details:**
   ```bash
   pulumi stack output publicIp
   pulumi stack output publicDns
   ```

## 🔐 Access Methods

### Student Access

Students can connect via SSH using password authentication:

- **Username**: Their assigned student name (e.g., `student1`)
- **Password**: Same as username (e.g., `student1`)

```bash
ssh student1@<public-ip>
# Password: student1
```

> **Note**: Password authentication is enabled for educational purposes in this lab environment. This is not recommended for production systems due to security concerns.

### Admin Access

Administrators can connect using SSH key authentication:

- **Username**: `ec2-user` (default AWS user)
- **Authentication**: SSH public key (eg. `~/.ssh/id_rsa.pub`)

```bash
ssh -i ~/.ssh/id_rsa ec2-user@<public-ip>
```

## 📊 Monitoring & Logging

- **CloudWatch Logs**: All student shell activity is captured
- **Log Group**: `<stack-name>-logs`
- **Log Retention**: 7 days
- **Log Files**:
  - `/var/log/cloud-init-output.log` - Instance initialization
  - `/var/log/student-logs.log` - Student shell activity

## 🔧 Customization

You can customize the deployment by modifying the `StudentServer` constructor in `index.ts`:

```typescript
const studentServer = new StudentServer(pulumi.getStack(), {
  pubKey,
  students,
  instanceType,
  amiId,
});
```

**Purpose**: Educational infrastructure for coding workshops
