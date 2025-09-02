import { StudentServer } from "./components/student-server";
import * as fs from "fs";
import * as pulumi from "@pulumi/pulumi";

const studentServer = new StudentServer(pulumi.getStack(), {
  pubKey: fs.readFileSync(`${process.env.HOME}/.ssh/id_rsa.pub`).toString(),
  students: new pulumi.Config().requireObject<string[]>("students"),
});

export const publicIp = studentServer.publicIp;
export const publicDns = studentServer.publicDns;
