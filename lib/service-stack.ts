import {Stack, StackProps, Construct, Duration} from "@aws-cdk/core";
import {RestApi, EndpointType, LambdaIntegration} from "@aws-cdk/aws-apigateway";
import {Function as LambdaFunction, Runtime, Code} from "@aws-cdk/aws-lambda";
import {SecurityGroup, SubnetType, Peer, Port, InterfaceVpcEndpoint} from "@aws-cdk/aws-ec2";
import {ScalableTarget, ServiceNamespace, PredefinedMetric} from "@aws-cdk/aws-applicationautoscaling";
import {PolicyStatement, Effect, AnyPrincipal} from "@aws-cdk/aws-iam";
import VPCStack from "./vpc-stack";
import DataStack from "./data-stack";

/**
 * Stack for services
 */
export default class ServiceStack extends Stack {
  api: RestApi;
  service: LambdaFunction;
  serviceSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);
    let {vpcStack, dataStack} = props;
    let serviceSecurityGroup = this.serviceSecurityGroup = vpcStack.createSecurityGroup("serviceSecurityGroup");
    serviceSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443));
    this.createAPIGateway(vpcStack);
    this.createService(vpcStack, dataStack, "api");
  }

  /**
   * Create a API Gateway
   * @param {VPCStack} vpcStack - the VPC stack
   */
  createAPIGateway(vpcStack: VPCStack): void {
    let {vpc} = vpcStack;
    // let {serviceSecurityGroup} = this;
    // let vpcEndpoint = new InterfaceVpcEndpoint(this, 'ApiVpcEndpoint', {
    //   vpc,
    //   service: {
    //     name: `com.amazonaws.${Stack.of(this).region}.execute-api`,
    //     port: 443,
    //   },
    //   subnets: {
    //     subnetType: SubnetType.PRIVATE,
    //   },
    //   securityGroups: [serviceSecurityGroup],
    //   privateDnsEnabled: true,
    // });
    this.api = new RestApi(this, "api", {
      deployOptions: {
        metricsEnabled: true,
        // loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      // endpointConfiguration: {
      //   types: [EndpointType.PRIVATE],
      //   vpcEndpoints: [vpcEndpoint],
      // },
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
    let {api, serviceSecurityGroup} = this;
    let {vpc} = vpcStack;
    let {internalStore, dbProxy} = dataStack;
    // let invokePolicy = new PolicyStatement({
    //   principals: [new AnyPrincipal()],
    //   effect: Effect.ALLOW,
    //   actions: ["execute-api:Invoke"],
    //   resources: ["execute-api:/*"],
    // });
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
      securityGroups: [serviceSecurityGroup],
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
    // grant connection access to the database proxy
    dbProxy.grantConnect(service);
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
