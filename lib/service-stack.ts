import {Stack, StackProps, Construct, Duration} from "@aws-cdk/core";
import {RestApi, Cors, LambdaIntegration} from "@aws-cdk/aws-apigateway";
import {Function as LambdaFunction, Runtime, Code} from "@aws-cdk/aws-lambda";
import {SubnetType} from "@aws-cdk/aws-ec2";
import {ScalableTarget, ServiceNamespace, PredefinedMetric} from "@aws-cdk/aws-applicationautoscaling";
import {PolicyStatement, Effect} from "@aws-cdk/aws-iam";
import VPCStack from "./vpc-stack";
import DataStack from "./data-stack";

/**
 * Stack for services
 */
export default class ServiceStack extends Stack {
  api: RestApi;
  service: LambdaFunction;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);
    let {vpcStack, dataStack} = props;
    this.createAPIGateway(vpcStack);
    this.createService(vpcStack, dataStack, "api");
  }

  /**
   * Create a API Gateway
   * @param {VPCStack} vpcStack - the VPC stack
   */
  createAPIGateway(vpcStack: VPCStack): void {
    this.api = new RestApi(this, "api", {
      deployOptions: {
        // stageName: "beta",
        metricsEnabled: true,
        // loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      // enable CORS
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowCredentials: true,
      },
    });
  }

  /**
   * Create a Lambda service
   * @param {VPCStack} vpcStack - the VPC stack
   * @param {DataStack} dataStack - the database stack
   * @param {string} path - the HTTP route path of the API
   * @param {string} apiMethod - the HTTP method of the API
   * @returns {LambdaFunction} the Lambda service
   */
  createService(vpcStack: VPCStack, dataStack: DataStack, path: string, apiMethod: string = "GET"): LambdaFunction {
    let {api} = this;
    let {vpc} = vpcStack;
    let {internalStore, dbProxy} = dataStack;
    let storeAccessPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:*"],
      resources: [`${internalStore.bucketArn}/*`],
    });
    let service = this.service = new LambdaFunction(this, "lambdaService", {
      runtime: Runtime.GO_1_X,
      handler: "main",  // links to a file inside the code artifact below
      code: Code.fromAsset("./lambda"),
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        STORE: internalStore.bucketName,
      },
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE,
      },
      // securityGroup:
      initialPolicy: [storeAccessPolicy],
    });
    let apiRes = api.root.addResource(path);
    apiRes.addMethod(apiMethod, new LambdaIntegration(service));
    // enable auto scaling for lambda functions
    let lambdaScaling = new ScalableTarget(this, "lambdaScaling", {
      serviceNamespace: ServiceNamespace.LAMBDA,
      minCapacity: 2,
      maxCapacity: 100,
      resourceId: `function:${service.functionName}:${service.currentVersion.version}`,
      scalableDimension: "lambda:function:ProvisionedConcurrency",
    });
    lambdaScaling.scaleToTrackMetric("lambdaScalingTracking", {
      predefinedMetric: PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
      targetValue: 0.9,
    });
    // grant connection access to the proxy
    dbProxy.grantConnect(service, "dbAdmin");
    return service;
  }
}

// the service stack initial properties
interface ServiceStackProps extends StackProps {
  vpcStack: VPCStack;
  dataStack: DataStack;
  // whether enable debug mode
  debug?: boolean;
}
