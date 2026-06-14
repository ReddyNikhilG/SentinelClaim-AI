import { ClaimFormData, RiskCategory, FraudFactor } from '@/types/claims';

interface FraudAnalysisResult {
  score: number;
  category: RiskCategory;
  factors: FraudFactor[];
}

// Simulated fraud scoring algorithm based on Guidewire patterns
export function calculateFraudScore(claim: ClaimFormData): FraudAnalysisResult {
  const factors: FraudFactor[] = [];
  let totalScore = 0;

  // Factor 1: Claim Amount Analysis (higher amounts = higher risk)
  const amount = parseFloat(claim.claim_amount);
  if (amount > 500000) {
    factors.push({
      name: 'Extreme Claim Value',
      weight: 40,
      description: 'Claims exceeding $500,000 require immediate SIU review',
    });
    totalScore += 40;
  } else if (amount > 100000) {
    factors.push({
      name: 'Very High Claim Value',
      weight: 35,
      description: 'Claims exceeding $100,000 require enhanced investigation',
    });
    totalScore += 35;
  } else if (amount > 75000) {
    factors.push({
      name: 'High Claim Value',
      weight: 30,
      description: 'Claims exceeding $75,000 flagged for SIU attention',
    });
    totalScore += 30;
  } else if (amount > 50000) {
    factors.push({
      name: 'Elevated Claim Value',
      weight: 25,
      description: 'Claims exceeding $50,000 require enhanced review',
    });
    totalScore += 25;
  } else if (amount > 25000) {
    factors.push({
      name: 'Moderate-High Claim Value',
      weight: 15,
      description: 'Claims between $25,000-$50,000 flagged for review',
    });
    totalScore += 15;
  } else if (amount > 10000) {
    factors.push({
      name: 'Moderate Claim Value',
      weight: 8,
      description: 'Standard review for claims over $10,000',
    });
    totalScore += 8;
  }

  // Factor 2: Incident Timing Analysis
  const incidentDate = new Date(claim.incident_date);
  const today = new Date();
  const daysSinceIncident = Math.floor((today.getTime() - incidentDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceIncident < 1) {
    factors.push({
      name: 'Same-Day Filing',
      weight: 15,
      description: 'Claim filed on same day as incident - unusual pattern',
    });
    totalScore += 15;
  } else if (daysSinceIncident > 30) {
    factors.push({
      name: 'Delayed Reporting',
      weight: 20,
      description: 'Claim filed more than 30 days after incident',
    });
    totalScore += 20;
  }

  // Factor 3: Claim Type Risk Profile
  const typeRiskMap: Record<string, number> = {
    'auto': 10,
    'property': 12,
    'liability': 18,
    'workers_comp': 15,
    'health': 8,
  };
  
  const typeRisk = typeRiskMap[claim.claim_type] || 10;
  if (typeRisk > 12) {
    factors.push({
      name: 'High-Risk Claim Category',
      weight: typeRisk,
      description: `${claim.claim_type.replace('_', ' ')} claims have elevated fraud indicators`,
    });
  }
  totalScore += typeRisk;

  // Factor 4: Location Risk (simulated geo-risk scoring)
  const highRiskKeywords = ['downtown', 'highway', 'interstate', 'parking lot', 'mall'];
  const locationLower = claim.incident_location.toLowerCase();
  const locationMatch = highRiskKeywords.some(keyword => locationLower.includes(keyword));
  
  if (locationMatch) {
    factors.push({
      name: 'High-Risk Location',
      weight: 12,
      description: 'Incident location matches high-frequency claim areas',
    });
    totalScore += 12;
  }

  // Factor 5: Description Analysis (keyword-based risk)
  if (claim.description) {
    const suspiciousKeywords = ['total loss', 'stolen', 'fire', 'flood', 'vandalism', 'hit and run'];
    const descLower = claim.description.toLowerCase();
    const matchedKeywords = suspiciousKeywords.filter(keyword => descLower.includes(keyword));
    
    if (matchedKeywords.length > 0) {
      const weight = Math.min(matchedKeywords.length * 8, 20);
      factors.push({
        name: 'Risk Keywords Detected',
        weight,
        description: `Description contains ${matchedKeywords.length} elevated-risk term(s)`,
      });
      totalScore += weight;
    }
  }

  // Factor 6: Contact Information Completeness
  if (!claim.claimant_email || !claim.claimant_phone) {
    factors.push({
      name: 'Incomplete Contact Information',
      weight: 10,
      description: 'Missing email or phone number reduces verification options',
    });
    totalScore += 10;
  }

  // Normalize score to 0-100 range
  const normalizedScore = Math.min(Math.round(totalScore), 100);

  // Determine risk category
  let category: RiskCategory;
  if (normalizedScore >= 60) {
    category = 'high';
  } else if (normalizedScore >= 35) {
    category = 'medium';
  } else {
    category = 'low';
  }

  return {
    score: normalizedScore,
    category,
    factors,
  };
}

// Determine claim routing based on risk score
export function determineClaimRouting(riskCategory: RiskCategory): {
  assignedGroup: string;
  status: 'pending' | 'under_review' | 'siu_investigation' | 'auto_approved';
} {
  switch (riskCategory) {
    case 'low':
      return {
        assignedGroup: 'Auto-Processing',
        status: 'auto_approved',
      };
    case 'medium':
      return {
        assignedGroup: 'Adjuster Review Team',
        status: 'under_review',
      };
    case 'high':
      return {
        assignedGroup: 'Special Investigation Unit (SIU)',
        status: 'siu_investigation',
      };
  }
}
