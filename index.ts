import * as aws from "@pulumi/aws";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const sg = new aws.ec2.SecurityGroup("student-sg", {
  description: "Allow SSH inbound",
  ingress: [
    {
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
    },
  ],
});

const ami = aws.ec2.getAmiOutput({
  mostRecent: true,
  owners: ["amazon"],
  filters: [{ name: "name", values: ["amzn2-ami-hvm-*-x86_64-gp2"] }],
});

const pubKey = fs
  .readFileSync(`${process.env.HOME}/.ssh/id_rsa.pub`)
  .toString();
console.log("pubKey", pubKey);
const key = new aws.ec2.KeyPair("student-key", {
  publicKey: pubKey,
  tags: {
    Name: "student-key",
    Environment: "learning",
    Owner: "student",
  },
});

// ---------- IAM Role + Instance Profile ----------
const cwRole = new aws.iam.Role("cw-agent-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: "ec2.amazonaws.com",
  }),
});

new aws.iam.RolePolicyAttachment("cw-agent-attach", {
  role: cwRole.name,
  policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
});

const instanceProfile = new aws.iam.InstanceProfile("cw-agent-profile", {
  role: cwRole.name,
});

const logGroup = new aws.cloudwatch.LogGroup("student-logs", {
  retentionInDays: 7,
});

const students = ["student1", "student2", "student3", "student4", "student5"];

const userData = logGroup.name.apply((name) => {
  let script = `#!/bin/bash
set -e

# Enable password authentication
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

# Install CloudWatch Agent
yum install -y amazon-cloudwatch-agent

# Create config in correct directory
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/cloud-init-output.log",
            "log_group_name": "${name}",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

systemctl enable amazon-cloudwatch-agent
systemctl restart amazon-cloudwatch-agent
`;

  // Append student creation
  students.forEach((s) => {
    script += `
id -u ${s} &>/dev/null || useradd -m -s /bin/bash ${s}
echo "${s}:${s}" | chpasswd
echo "Created user ${s}" >> /var/log/student-setup.log
`;
  });

  return script;
});

const server = new aws.ec2.Instance("student-server", {
  instanceType: "t2.micro",
  ami: ami.id,
  keyName: key.keyName,
  vpcSecurityGroupIds: [sg.id],
  iamInstanceProfile: instanceProfile.name,
  tags: {
    Name: "student-server",
  },
  userData: userData,
});

export const publicIp = server.publicIp;
export const publicDns = server.publicDns;
