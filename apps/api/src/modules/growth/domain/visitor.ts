/** Where a visitor came from: first touch is kept, later visits do not overwrite it. */
export interface Attribution {
  landingPath: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export interface VisitorState {
  id: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  attribution: Attribution;
  userAgent: string | null;
  language: string | null;
  ipHash: string;
  country: string | null;
  analyticsConsent: boolean;
  marketingConsent: boolean;
  consentAt: Date | null;
  userId: string | null;
  visits: number;
}

const cut = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

/**
 * Aggregate: a browser, known by the random id it keeps. Holds attribution and consent; nothing that identifies
 * a person until they give an e-mail (then it is linked to a Lead) or sign in (linked to the account).
 */
export class Visitor {
  private constructor(private state: VisitorState) {}

  static first(id: string, attribution: Attribution, context: { userAgent?: string; language?: string; ipHash: string; country?: string }, now = new Date()): Visitor {
    return new Visitor({
      id,
      firstSeenAt: now,
      lastSeenAt: now,
      attribution: {
        landingPath: cut(attribution.landingPath, 300) ?? '/',
        referrer: cut(attribution.referrer, 300),
        utmSource: cut(attribution.utmSource, 100),
        utmMedium: cut(attribution.utmMedium, 100),
        utmCampaign: cut(attribution.utmCampaign, 100),
      },
      userAgent: cut(context.userAgent, 300),
      language: cut(context.language, 20),
      ipHash: context.ipHash,
      country: cut(context.country, 2),
      analyticsConsent: false,
      marketingConsent: false,
      consentAt: null,
      userId: null,
      visits: 1,
    });
  }

  static restore(state: VisitorState): Visitor {
    return new Visitor({ ...state });
  }

  get id(): string { return this.state.id; }
  get analyticsConsent(): boolean { return this.state.analyticsConsent; }
  get attribution(): Attribution { return this.state.attribution; }
  snapshot(): VisitorState { return { ...this.state }; }

  seenAgain(ipHash: string, now = new Date()): void {
    // A new session counts as a visit after 30 minutes of silence.
    if (now.getTime() - this.state.lastSeenAt.getTime() > 30 * 60_000) this.state.visits++;
    this.state.lastSeenAt = now;
    this.state.ipHash = ipHash;
  }

  consent(analytics: boolean, marketing: boolean, now = new Date()): void {
    this.state.analyticsConsent = analytics;
    this.state.marketingConsent = marketing;
    this.state.consentAt = now;
  }

  linkUser(userId: string): void {
    this.state.userId = userId;
  }
}
