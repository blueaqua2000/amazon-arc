import {Stack, StackProps, Construct, Duration, RemovalPolicy} from "@aws-cdk/core";
import {DatabaseCluster, DatabaseClusterEngine, AuroraMysqlEngineVersion, DatabaseProxy, ProxyTarget, Credentials} from "@aws-cdk/aws-rds";
import {ScalableTarget, ServiceNamespace, PredefinedMetric} from "@aws-cdk/aws-applicationautoscaling";
import {SubnetType, Peer, Port, GatewayVpcEndpointAwsService} from "@aws-cdk/aws-ec2";
import {Bucket, BucketEncryption, BlockPublicAccess, StorageClass} from "@aws-cdk/aws-s3";
import VPCStack from "./vpc-stack";

/**
 * Stack for data and storage
 */
export default class DataStack extends Stack {
  db: DatabaseCluster;
  dbProxy: DatabaseProxy;
  internalStore: Bucket;
  // whether enable debug mode that remove contents of db and bucket
  debug: boolean;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    let {vpcStack, debug = false} = props;
    this.debug = debug;
    // Create database and proxy
    this.createDatabase(vpcStack);
    // Create a internal storage for business service
    let storage = this.createInternalStore(vpcStack);
  }

  /**
   * Create database cluster and proxy
   * @param {VPCStack} vpcStack - the vpc stack
   * @returns {DatabaseCluster} the database cluster
   */
  createDatabase(vpcStack: VPCStack): DatabaseCluster {
    let {vpc} = vpcStack;
    let db = this.db = new DatabaseCluster(this, "db", {
      engine: DatabaseClusterEngine.auroraMysql({
        version: AuroraMysqlEngineVersion.VER_2_08_1,
      }),
      credentials: Credentials.fromGeneratedSecret(DB_ADMIN_USERNAME),
      iamAuthentication: true,
      storageEncrypted: true,
      instanceProps: {
        vpcSubnets: {
          subnetType: SubnetType.ISOLATED,
        },
        vpc,
      },
    });
    // enable auto scaling for database
    let dbScaling = new ScalableTarget(this, "dbScaling", {
      serviceNamespace: ServiceNamespace.RDS,
      minCapacity: 3,
      maxCapacity: 15,
      resourceId: `cluster:${db.clusterIdentifier}`,
      scalableDimension: "rds:cluster:ReadReplicaCount",
    });
    dbScaling.scaleToTrackMetric("dbScalingTracking", {
      predefinedMetric: PredefinedMetric.RDS_READER_AVERAGE_CPU_UTILIZATION,
      targetValue: 60,
    });
    // allow connections to the database proxy from services (private subnet)
    let dbProxySecurityGroup = vpcStack.createSecurityGroup("dbProxySecurityGroup", {
      allowAllOutbound: false,
    });
    dbProxySecurityGroup.connections.allowFrom(Peer.ipv4("10.0.0.0/24"), Port.tcp(3306), "Allow connections to the database proxy from services (private subnet)");
    // create the database proxy
    let dbProxy = this.dbProxy = new DatabaseProxy(this, "dbProxy", {
      proxyTarget: ProxyTarget.fromCluster(db),
      requireTLS: true,
      secrets: [db.secret!],
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.ISOLATED,
      },
      securityGroups: [dbProxySecurityGroup],
    });
    // allow connections to the database cluster from the proxy
    db.connections.allowFrom(dbProxy, Port.tcp(3306), "Allow connections to the database cluster from the proxy");
    return db;
  }

  /**
   * Create a internal storage for business service
   * @param {VPCStack} vpcStack - the vpc stack
   * @returns {Bucket} the internal storage
   */
  createInternalStore(vpcStack: VPCStack): Bucket {
    let {vpc} = vpcStack;
    let {debug} = this;
    let bucket = this.internalStore = new Bucket(this, "internalStore", {
      encryption: BucketEncryption.KMS_MANAGED,
      enforceSSL: true,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [{
        transitions: [{
          // archive inactive objects greater than 6 months
          storageClass: StorageClass.GLACIER,
          transitionAfter: Duration.days(180),
        }],
      }],
      removalPolicy: debug ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
    vpc.addGatewayEndpoint("storeGateway", {
      service: GatewayVpcEndpointAwsService.S3,
      subnets: [{
        subnetType: SubnetType.ISOLATED,
      }],
    });
    return bucket;
  }
}

const DB_ADMIN_USERNAME = "dbAdmin";

// the data stack initial properties
interface DataStackProps extends StackProps {
  vpcStack: VPCStack;
  // whether enable debug mode
  debug?: boolean;
}
