import {expect as expectCDK, haveResource} from "@aws-cdk/assert";
import {App} from "@aws-cdk/core";
import VPCStack from "../lib/vpc-stack";
import DataStack from '../lib/data-stack';
import ServiceStack from "../lib/service-stack";

let app = new App();
let vpcStack = new VPCStack(app, "testVPCStack");
let dataStack = new DataStack(app, "testDataStack", {
  vpcStack,
});
let serviceStack = new ServiceStack(app, "testServiceStack", {
  vpcStack,
  dataStack,
});

test("The lambda runtime is golang", () => {
  expectCDK(serviceStack).to(haveResource("AWS::Lambda::Function", {
    Runtime: "go1.x",
  }));
});
