import {expect as expectCDK, haveResource} from "@aws-cdk/assert";
import {App} from "@aws-cdk/core";
import VPCStack from '../lib/vpc-stack';

let app = new App();
let stack = new VPCStack(app, "testVPCStack");

test("VPC is created", () => {
  expectCDK(stack).to(haveResource("AWS::EC2::VPC", {
    CidrBlock: "10.0.0.0/16",
  }));
});
