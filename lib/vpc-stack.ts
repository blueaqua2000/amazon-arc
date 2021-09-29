import {Stack, StackProps, Construct} from "@aws-cdk/core";
import {Vpc, SubnetType, SecurityGroup} from "@aws-cdk/aws-ec2";

/**
 * Stack for VPC
 */
export default class VPCStack extends Stack {
  vpc: Vpc;

  constructor(scope: Construct, id: string, props?: VPCStackProps) {
    super(scope, id, props);
    this.createVPC();
  }

  /**
   * create a VPC
   * @returns {Vpc} - the VPC created
   */
  createVPC(): Vpc {
    return this.vpc = new Vpc(this, "appVPC", {
      cidr: "10.0.0.0/16",
      // cross all of the available zones for high availability
      maxAzs: 99,
      subnetConfiguration: [{
        name: ISOLATED_SUBNET_NAME,
        subnetType: SubnetType.ISOLATED,
        cidrMask: 28,
      }, {
        name: PRIVATE_SUBNET_NAME,
        subnetType: SubnetType.PRIVATE,
        cidrMask: 24,
      }, {
        name: PUBLIC_SUBNET_NAME,
        subnetType: SubnetType.PUBLIC,
        cidrMask: 26,
      }],
    });
  }

  /**
   * create a security group within the current VPC
   * @param {string} id - the security group id
   * @param {SecurityGroupProps} [props] - the security group properties
   * @returns {SecurityGroup} the security group created
   */
  createSecurityGroup(id: string, props?: SecurityGroupProps): SecurityGroup {
    let {vpc} = this;
    return new SecurityGroup(this, id, {
      ...(props || {}),
      vpc,
    });
  }
}

const ISOLATED_SUBNET_NAME = "isolatedSubnet";
const PRIVATE_SUBNET_NAME = "privateSubnet";
const PUBLIC_SUBNET_NAME = "publicSubnet";

// the vpc stack initial properties
interface VPCStackProps extends StackProps {
  // whether enable debug mode
  debug?: boolean;
}
// the security group properties
interface SecurityGroupProps {
  securityGroupName?: string;
  allowAllOutbound?: boolean;
  disableInlineRules?: boolean;
  description?: string;
}
