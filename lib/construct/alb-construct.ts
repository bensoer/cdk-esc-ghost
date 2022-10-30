import { CfnOutput } from "aws-cdk-lib";
import { ICertificate } from "aws-cdk-lib/aws-certificatemanager";
import { ISecurityGroup, IVpc } from "aws-cdk-lib/aws-ec2";
import { ApplicationListener, ApplicationLoadBalancer, ApplicationProtocol, ApplicationProtocolVersion, ApplicationTargetGroup, IApplicationLoadBalancer, SslPolicy, TargetType } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { ParameterTier, StringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

export interface ALBConstructProps {
    vpc: IVpc,
    vpcSecurityGroup: ISecurityGroup
    certificates?: Array<ICertificate>
    loadBalancerName?: string
}

export class ALBConstruct extends Construct {

    public readonly alb: ApplicationLoadBalancer
    public readonly defaultTargetGroup: ApplicationTargetGroup
    public readonly defaultSecureListener: ApplicationListener

    constructor(scope: Construct, id:string, props: ALBConstructProps){
        super(scope, id)

        this.alb = new ApplicationLoadBalancer(this, 'ApplicationLoadBalancer', {
            loadBalancerName: props.loadBalancerName,
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: props.vpcSecurityGroup,
            
        })
      
        this.alb.setAttribute('routing.http.preserve_host_header.enabled', 'true') // Enable forwarding host header
        this.alb.setAttribute('routing.http.xff_client_port.enabled', 'true') // Enabled x-forwarded-for header
    
        this.alb.addRedirect({
            sourceProtocol: ApplicationProtocol.HTTP,
            sourcePort: 80,
            targetProtocol: ApplicationProtocol.HTTPS,
            targetPort: 443
        })

        this.defaultTargetGroup = new ApplicationTargetGroup(this, 'DefaultApplicationTargetGroup', {
            targetType: TargetType.IP,
            vpc: props.vpc,
            protocol: ApplicationProtocol.HTTP,
            protocolVersion: ApplicationProtocolVersion.HTTP1,
        })

        this.defaultSecureListener = new ApplicationListener(this, 'DefaultSecureApplicationListener', {
            loadBalancer: this.alb,
            port: 443,
            protocol: ApplicationProtocol.HTTPS,
            sslPolicy: SslPolicy.RECOMMENDED,
            defaultTargetGroups: [
              this.defaultTargetGroup
            ],
            certificates: props.certificates,
        })

        // ECS Load Balancer Parameters
        new StringParameter(this, 'ApplicationLoadBalancerARN', {
            parameterName: '/alb/arn',
            description: 'ApplicationLoadBalancer ARN',
            stringValue: this.alb.loadBalancerArn,
            tier: ParameterTier.STANDARD
        })
        new StringParameter(this, 'DefaultSecureApplicationListenerARN', {
            parameterName: '/ecs/alb/ssllistener/arn',
            description: 'ApplicationLoadBalancer Default SSL Listener ARN',
            stringValue: this.defaultSecureListener.listenerArn,
            tier: ParameterTier.STANDARD
        })
        new StringParameter(this, 'ApplicationLoadBalancerDNSName', {
            parameterName: '/ecs/alb/ssllistener/dnsName',
            description: 'ApplicationLoadBalancer DNS Name',
            stringValue: this.alb.loadBalancerDnsName,
            tier: ParameterTier.STANDARD
        })
        new StringParameter(this, 'ApplicationLoadBalancerCanonicalHostedZoneId', {
            parameterName: '/ecs/alb/ssllistener/canonicalHostedZoneId',
            description: 'ApplicationLoaderBalancer Canonical Hosted Zone ID',
            stringValue: this.alb.loadBalancerCanonicalHostedZoneId,
            tier: ParameterTier.STANDARD
        })

        new CfnOutput(this, 'Output-ApplicationLoadBalancerARN', {
            value: this.alb.loadBalancerArn,
            description: 'ApplicationLoadBalancer ARN',
        })
    }
}