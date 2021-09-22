import {expect as expectCDK, haveResource, objectLike} from "@aws-cdk/assert";
import {App} from "@aws-cdk/core";
import WebsiteStack from '../lib/website-stack';

let app = new App();
let websiteStack = new WebsiteStack(app, "testWebsiteStack");

test("The bucket is public readable", () => {
  expectCDK(websiteStack).to(haveResource("AWS::S3::Bucket", {
    PublicAccessBlockConfiguration: objectLike({
      BlockPublicAcls: false,
      BlockPublicPolicy: false,
      IgnorePublicAcls: false,
      RestrictPublicBuckets: false,
    }),
  }));
});
