#!/usr/bin/env node
import "source-map-support/register";
import {App, CfnParameter} from "@aws-cdk/core";
import VPCStack from "../lib/vpc-stack";
import DataStack from "../lib/data-stack";
import ServiceStack from "../lib/service-stack";
import WebsiteStack from "../lib/website-stack";

// For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html
let app = new App();
let debug = app.node.tryGetContext("debug");
let vpcStack = new VPCStack(app, "vpcStack", {
  debug,
});
let dataStack = new DataStack(app, "dataStack", {
  vpcStack,
  debug,
});
let serviceStack = new ServiceStack(app, "serviceStack", {
  vpcStack,
  dataStack,
  debug,
});
let websiteStack = new WebsiteStack(app, "websiteStack", {
  debug,
});

/* If you don't specify 'env', this stack will be environment-agnostic.
 * Account/Region-dependent features and context lookups will not work,
 * but a single synthesized template can be deployed anywhere. */

/* Uncomment the next line to specialize this stack for the AWS Account
 * and Region that are implied by the current CLI configuration. */
// env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

/* Uncomment the next line if you know exactly what Account and Region you
 * want to deploy the stack to. */
// env: { account: '123456789012', region: 'us-east-1' },
