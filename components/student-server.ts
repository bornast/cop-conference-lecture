import * as aws from "@pulumi/aws";
import * as fs from "fs";
import * as pulumi from "@pulumi/pulumi";
import { LogGroup } from "@pulumi/aws/cloudwatch";

type StudentServerArgs = {
  students: string[];
  pubKey: string;
  instanceType?: string;
  amiId?: string;
};

export class StudentServer extends pulumi.ComponentResource {
  public readonly publicIp: pulumi.Output<string>;
  public readonly publicDns: pulumi.Output<string>;

  constructor(
    name: string,
    args: StudentServerArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("edu:ec2:StudentServer", name, {}, opts);

    const { students, pubKey, amiId, instanceType = "t2.micro" } = args;
    const securityGroup = this.createSecurityGroup(name);
    const ami = amiId || this.getAMI().id;
    const keyPair = this.createKeyPair(name, pubKey);
    const instanceProfile = this.createInstanceProfile(name);
    const logGroup = this.createLogGroup(name);
    const userData = this.createUserDataLogs(logGroup, students);

    const server = new aws.ec2.Instance(
      `${name}-instance`,
      {
        instanceType,
        ami,
        keyName: keyPair.keyName,
        vpcSecurityGroupIds: [securityGroup.id],
        iamInstanceProfile: instanceProfile.name,
        tags: { Name: `${name}-instance` },
        userData,
      },
      { parent: this }
    );

    this.publicIp = server.publicIp;
    this.publicDns = server.publicDns;
    this.registerOutputs();
  }

  private createSecurityGroup(name: string) {
    return new aws.ec2.SecurityGroup(
      `${name}-sg`,
      {
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
          { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
        ],
      },
      { parent: this }
    );
  }

  private getAMI() {
    return aws.ec2.getAmiOutput({
      mostRecent: true,
      owners: ["amazon"],
      filters: [{ name: "name", values: ["amzn2-ami-hvm-*-x86_64-gp2"] }],
    });
  }

  private createKeyPair(name: string, pubKey: string) {
    return new aws.ec2.KeyPair(
      `${name}-key`,
      {
        publicKey: pubKey,
      },
      { parent: this }
    );
  }

  private createInstanceProfile(name: string) {
    const cwRole = new aws.iam.Role(
      `${name}-cw-role`,
      {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
          Service: "ec2.amazonaws.com",
        }),
      },
      { parent: this }
    );

    new aws.iam.RolePolicyAttachment(
      `${name}-cw-policy`,
      {
        role: cwRole.name,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
      },
      { parent: this }
    );

    const instanceProfile = new aws.iam.InstanceProfile(
      `${name}-cw-profile`,
      {
        role: cwRole.name,
      },
      { parent: this }
    );
    return instanceProfile;
  }

  private createLogGroup(name: string) {
    return new aws.cloudwatch.LogGroup(
      `${name}-logs`,
      {
        retentionInDays: 7,
      },
      { parent: this }
    );
  }

  private createUserDataLogs(logGroup: LogGroup, students: string[]) {
    return logGroup.name.apply((lgName) => {
      let script = `
        #!/bin/bash
        set -e

        # Enable password authentication
        sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
        systemctl restart sshd

        # Install CloudWatch Agent
        yum install -y amazon-cloudwatch-agent

        # Prepare log file
        touch /var/log/student-logs.log
        chmod 666 /var/log/student-logs.log

        # CloudWatch Agent config
        mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
        cat <<EOF > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
        {
        "logs": {
            "logs_collected": {
            "files": {
                "collect_list": [
                { "file_path": "/var/log/cloud-init-output.log", "log_group_name": "${lgName}", "log_stream_name": "{instance_id}" },
                { "file_path": "/var/log/student-logs.log", "log_group_name": "${lgName}", "log_stream_name": "{instance_id}" }
                ]
            }
            }
        }
        }
        EOF

        systemctl enable amazon-cloudwatch-agent
        systemctl restart amazon-cloudwatch-agent`;

      students.forEach((s) => {
        script += `
        id -u ${s} &>/dev/null || useradd -m -s /bin/bash ${s}
        echo "${s}:${s}" | chpasswd
        echo 'exec > >(tee -a /var/log/student-logs.log) 2>&1' >> /home/${s}/.bashrc
        chown ${s}:${s} /home/${s}/.bashrc`;
      });

      return script.replace(/^[ \t]+/gm, "");
    });
  }
}
