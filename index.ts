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
  .readFileSync(path.join(os.homedir(), ".ssh", "id_rsa.pub"), "utf8")
  .trim();
const key = new aws.ec2.KeyPair("student-key", {
  publicKey: pubKey,
  tags: {
    Name: "student-key",
    Environment: "learning",
    Owner: "student",
  },
});

const students = ["student1", "student2", "student3", "student4", "student5"];

let userData = `
    #!/bin/bash
    set -e
    sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
    systemctl restart sshd`;

students.forEach((s) => {
  userData += `
    id -u ${s} &>/dev/null || useradd -m -s /bin/bash ${s}
    echo "${s}:${s}" | chpasswd
    `;
});

const server = new aws.ec2.Instance("student-server", {
  instanceType: "t2.micro",
  ami: ami.id,
  keyName: key.keyName,
  vpcSecurityGroupIds: [sg.id],
  tags: {
    Name: "student-server",
  },
  userData: userData,
});

export const publicIp = server.publicIp;
export const publicDns = server.publicDns;
