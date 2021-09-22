import {Stack, StackProps, Construct, RemovalPolicy} from "@aws-cdk/core";
import {PolicyStatement, Effect, AnyPrincipal} from "@aws-cdk/aws-iam";
import {Bucket, HttpMethods, BlockPublicAccess} from "@aws-cdk/aws-s3";
import {Distribution, AllowedMethods, CachePolicy, ViewerProtocolPolicy} from "@aws-cdk/aws-cloudfront";
import {S3Origin} from "@aws-cdk/aws-cloudfront-origins";

/**
 * Stack for static website
 */
export default class WebsiteStack extends Stack {
  staticResBucket: Bucket;
  websiteCDN: Distribution;
  // whether enable debug mode that remove contents of buckets
  debug: boolean;

  constructor(scope: Construct, id: string, props?: WebsiteStackProps) {
    super(scope, id, props);
    let {debug = false} = props || {};
    this.debug = debug;
    // Create a S3 bucket to host the static resources of website.
    let resBucket = this.createStaticResourceBucket();
    // Creates a CloudFront distribution for the resource bucket.
    this.createCDN(resBucket);
  }

  /**
   * Create a S3 bucket to host the static resources of website.
   * @returns {Bucket} the website resource bucket
   */
  createStaticResourceBucket(): Bucket {
    let {debug} = this;
    let staticResBucket = this.staticResBucket = new Bucket(this, "staticResBucket", {
      publicReadAccess: true,
      blockPublicAccess: new BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      enforceSSL: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "error.html",
      versioned: false,
      cors: [{
        allowedOrigins: ["*"],
        allowedMethods: [
          HttpMethods.GET,
        ],
      }],
      removalPolicy: debug ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
    // allow public read
    staticResBucket.addToResourcePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:GetObject"],
      resources: [`${staticResBucket.bucketArn}/*`],
      principals: [new AnyPrincipal()],
    }));
    return staticResBucket;
  }

  /**
   * Create a CloudFront distribution, use S3 bucket as the origin server.
   * @param {Bucket} resBucket - the website resource bucket
   * @returns {Distribution} the CloudFront distribution created
   */
  createCDN(resBucket: Bucket): Distribution {
    let origin = new S3Origin(resBucket);
    return this.websiteCDN = new Distribution(this, "websiteCDN", {
      defaultBehavior: {
        origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });
  }
}

// the website stack initial properties
interface WebsiteStackProps extends StackProps {
  // whether enable debug mode
  debug?: boolean;
}
