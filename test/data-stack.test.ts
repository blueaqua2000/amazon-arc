import {expect as expectCDK, haveResource, objectLike} from "@aws-cdk/assert";
import {App} from "@aws-cdk/core";
import VPCStack from "../lib/vpc-stack";
import DataStack from '../lib/data-stack';

let app = new App();
let vpcStack = new VPCStack(app, "testVPCStack");
let dataStack = new DataStack(app, "testDataStack", {
  vpcStack,
});

test("The database is not public (isolated subnet)", () => {
  expectCDK(dataStack).to(haveResource("AWS::RDS::DBInstance", {
    PubliclyAccessible: false,
  }));
});

test("The database is encrypted", () => {
  expectCDK(dataStack).to(haveResource("AWS::RDS::DBCluster", {
    StorageEncrypted: true,
  }));
});

test("The internal store is not public", () => {
  expectCDK(dataStack).to(haveResource("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: objectLike({
      "BlockPublicAcls": true,
      "BlockPublicPolicy": true,
      "IgnorePublicAcls": true,
      "RestrictPublicBuckets": true
    }),
  }));
});
