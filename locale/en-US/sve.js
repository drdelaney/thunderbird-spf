var SVE_STRINGS = new Object();
SVE_STRINGS.DO_VERIFY = "Click on Verify Sender (SPF/DK) from the Tools menu.";
SVE_STRINGS.SCANNING_HEADERS = "Checking... (Reading message headers...)";
SVE_STRINGS.SCANNING = "SVE: Scanning...";
SVE_STRINGS.NOT_APPLICABLE1 = "Sender verification is not applicable for this message.";
SVE_STRINGS.NOT_APPLICABLE2 = "SVE: Not Applicable";
SVE_STRINGS.CANNOT_FIND_FROM = "Cannot determine sender address from mail message.";
SVE_STRINGS.MESSAGE_TOO_OLD = "Message is too old to verify sender.";
SVE_STRINGS.MESSAGE_IN_FUTURE = "Message date is in the future.  Sender verification skipped.";
SVE_STRINGS.LOCAL_MAIL = "Mail originates from your mail server, or message headers could not be understood.";
SVE_STRINGS.DOMAIN_LISTED_NOT_CHECKED = "Sender's claimed domain is in your list of domains to skip verification.";
SVE_STRINGS.CHECKING_DK = "SVE: Checking DK...";
SVE_STRINGS.DK_COMPUTING_SIGNATURE = "Checking... (Computing DomainKeys signature...)";
SVE_STRINGS.DK_ABORTED1 = "DomainKeys verification will take too long.  Cannot verify sender.";
SVE_STRINGS.DK_ABORTED2 = "SVE: DK Aborted";
SVE_STRINGS.DK_CONTACTING_SERVER = "Checking... (Contacting DomainKeys verification server...)";
SVE_STRINGS.ERROR = "SVE: Error";
SVE_STRINGS.NO_EXPLANATION = "No explanation is available for this message.";
SVE_STRINGS.MTACHECK = function(hostname) { return "Sender was " + hostname + ". Is that in your network?"; };
SVE_STRINGS.CONFIRMED = function(domain) { return "Domain <" + domain + "> Confirmed."; };
SVE_STRINGS.CONFIRMED2 = "SVE: Domain Confirmed";
SVE_STRINGS.ENVELOPE_CONFIRMED = function(domain) { return "\"From\" domain unverified. Envelope domain <" + domain + "> confirmed."; };
SVE_STRINGS.ENVELOPE_CONFIRMED2 = function(domain) { return "SVE: Real Domain: " + domain; };
SVE_STRINGS.FORWARDERCHECK = function(domain) { return "Is " + domain + " a mail list?"; };
SVE_STRINGS.USER_NOT_CHECKED = function(user) { return "User \"" + user + "\" not verified."; };
SVE_STRINGS.DO_YOU_TRUST_DOMAIN = "Do you trust this domain?";
SVE_STRINGS.ADDRESS_KNOWN = "Address is known to you.";
SVE_STRINGS.DOMAIN_KNOWN = "Domain is known to you.";
SVE_STRINGS.SENDER_UNKNOWN = "Sender is unknown to you.";
SVE_STRINGS.VIA = function(via) { return "(via " + via + ")"; };
SVE_STRINGS.FORGED = function(domain) { return "This does not appear to be a legitimate <" + domain + "> email."; };
SVE_STRINGS.FORGED2 = "SVE: Verification Failed";
SVE_STRINGS.LOCALSENDER = function(domain) { return "Senders claiming your own domain <" + domain + "> cannot be verified."; };
SVE_STRINGS.NOT_SUPPORTED = "Sending domain does not support verification (address could be forged).";
SVE_STRINGS.NOT_VERIFIED = "SVE: Not Verified";
SVE_STRINGS.NEUTRAL = "Sending domain could not verify sender (address could be forged).";
SVE_STRINGS.DK_NOT_CHECKED = "DomainKeys not checked; address could be forged. (Enable DomainKeys in Tools->Extension->Options)";
SVE_STRINGS.ATTACK = "This sender is a known malicious spammer or phisher.  Discard this email.";
SVE_STRINGS.ATTACK2 = "SVE: Spam/Phishing Attack";
SVE_STRINGS.ERROR2 = "Error:";
SVE_STRINGS.MAIL_LIST = function(domain) { return "Message is confirmed from a <" + domain + "> mail list."; };
SVE_STRINGS.MAIL_LIST_EXPLANATION = "The original sender of mail list email cannot be verified.";
SVE_STRINGS.MAIL_LIST2 = function(domain) { return "SVE: Mail List Confirmed: " + domain; };
SVE_STRINGS.MAIL_LIST_UNVERIFIED = "Mail list domain could not be verified or does not support verification.";
SVE_STRINGS.UNVERIFIED_POPUP_ALERT = "The sending domain of this email could not be verified.  It is advised that you do not reply to this email, download any attachments, or follow any links in the email.\n\nThis warning can be turned off by going to the Sender Verification Extension options window, which can be found in Tools -> Extensions.";
SVE_STRINGS.CHECKING_RBLS1 = "Checking... (Checking sender in SURBL/Spamhaus spam and phishing lists...)";
SVE_STRINGS.CHECKING_RBLS2 = "SVE: Checking RBLs...";
SVE_STRINGS.BLACKLISTED = function(rbl) { return "The sender is listed in the " + rbl + " list of malicious spam or phishing scams."; };
SVE_STRINGS.SPF1 = "Checking... (Performing SPF verification...)";
SVE_STRINGS.SPF2 = "SVE: Checking SPF...";
SVE_STRINGS.DNS_TAKING_TIME = "[Try setting DNS server in options.]";
SVE_STRINGS.SERVER_ERROR = "There was a server error.";
SVE_STRINGS.REPUTABLE_SENDER = "Reputable Sender";
SVE_STRINGS.CHECK_DOMAIN_CAREFULLY = "Check domain carefully.";

