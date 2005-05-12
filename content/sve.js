/*
 * MOZILLA THUNDERBIRD EXTENSION FOR SENDER VERIFICATION
 *
 * Copyright 2004-2005 Joshua Tauberer <tauberer@for.net>
 *
 * Feel free to use and copy and modify this file however you like.
 *
 * While I disagree with the claim of the below statement, I must CYA
 * and include:  This code incorporates intellectual property owned by
 * Yahoo! and licensed pursuant to the Yahoo! DomainKeys Patent License
 * Agreement.
 */

// CONSTANTS

var useragent = "sve:0.7"; // The useragent field sent to the query server

// REGULAR EXPRESSIONS

var ReturnPathRegEx = /^Return-Path: <([^>]+)>/;
var ReceivedRegEx = /^Received: from ([\w\W]+) \([\w\W]*\[([\d\.]+)\]/; // The sendmail-style Received: header.
var ReceivedRegEx2 = /^Received: from \[([\d\.]+)\] \(helo=([^)]+)\)/; // An apparently Exim-style header: Received: from [65.54.185.19] (helo=hotmail.com)
var ReceivedRegEx3 = /^Received: from ([\w\.]+) \(([\d\.]+)\)/; // Yet another format
var ReceivedRegEx4 = /^Received: from [\w\W]+\((EHLO|HELO) ([\w\.]+)\) \(([\d\.]+)\)/; // Yet another format
var FromRegEx = /^From: [^<]*<([^>]+)>|^From: ([\w\d\._-]+@[\w\d\._-]+)/i;	
var DateRegEx = /^Date: ([\w\W]+)/i;

// MISC

var xmlhttp = new XMLHttpRequest();

var DAYS_TOO_OLD = 7; // THIS MANY DAYS IN THE PAST => NO SPF CHECK
var DAYS_IN_THE_FUTURE = 1.1; // THIS MANY DAYS IN THE FUTURE => NO SPF CHECK

// PREFERENCES

var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

var serverurl = "";
var checkonload = "";
var usedk = "";
var warnunverified;

// GLOBAL VARIABLES
// Yes it's a bad way to program, but it seems necessary in order
// to put some code in the xmlhttp callbacks.

var FromHdr = null;
var EnvFrom = null;
var DateHdr = null;

var HeloName = null;
var IPAddr = null;

var HeloName2 = null;
var IPAddr2 = null;

var DKHash = null;

var QueryReturn = null;
var QueryReturn2 = null;

var spfBox;
var statusText;
var statusLink;
var statusTrust;
var goMenu;
var goMenuSep;

var QueryCache = Array(0);
var QueryCacheNext = 0;
var QueryCacheMax = 100;

var lastCheckedEmail;

// Whenever the messagepane loads, run a SPF check.
var messagepane = document.getElementById("messagepane");
messagepane.addEventListener("load", sveRearrangeBoxes, true);
messagepane.addEventListener("load", spfGoEvent, true);

function spfLoadSettings() {
	serverurl = "";
	if (prefs.getPrefType("spf.queryserver") == prefs.PREF_STRING) {
		serverurl = prefs.getCharPref("spf.queryserver");
	}
	
	// Set the default query server.
	if (!serverurl) {
		serverurl = "http://taubz.for.net/code/spf/cgi-bin/query.cgi";
		prefs.setCharPref("spf.queryserver", serverurl);
	}
	
	// Check on mail load?
	checkonload = "";
	if (prefs.getPrefType("spf.checkonload") == prefs.PREF_STRING) {
		checkonload = prefs.getCharPref("spf.checkonload");
	}
	
	usedk = "yes";
	if (prefs.getPrefType("spf.domainkeys") == prefs.PREF_STRING) {
		usedk = prefs.getCharPref("spf.domainkeys");
	}
	
	warnunverified = false;
	if (prefs.getPrefType("spf.warnunverified") == prefs.PREF_STRING
		&& prefs.getCharPref("spf.warnunverified") == "yes") {
		warnunverified = true;
	}
	
}

function spfGoEvent() {
	// The timeout prevents a hang when loading IMAP messages with attachments
	window.setTimeout("spfGo(false);", 250);
}

var sveRearrangedBoxes = false;
function sveRearrangeBoxes() {
	// Mnenhy likes to replace the header box, so we need to insert a new
	// vbox between the hbox that is expandedHeaderView and its parent,
	// so we can put our box on top of the expandedHeaderView.
	
	if (sveRearrangedBoxes) return;
	sveRearrangedBoxes = true;
	
	var spfBox = document.getElementById("spfBox");
	var widget = document.getElementById("expandedHeaderView");
	var curContainer = widget.parentNode;
	var newContainer = document.createElement("vbox");
	curContainer.insertBefore(newContainer, widget);
	curContainer.removeChild(widget);
	newContainer.appendChild(widget);
	newContainer.insertBefore(spfBox, widget);
}

function spfGo(manual) {
	// Prevent two load events on the same email.
	var uri = GetFirstSelectedMessage();
	if (uri == lastCheckedEmail) return;
	lastCheckedEmail = uri;

	spfLoadSettings();
	
	// Get references to the XUL elements we use.
	spfBox = document.getElementById("spfBox");
	statusText = document.getElementById("spfStatusText");
	goMenu = document.getElementById("spf_GoMenu");
	goMenuSep = document.getElementById("spf_GoMenuSeparator");	
	statusLink = document.getElementById("spfLink");
	statusTrust = document.getElementById("spfTrust");
	
	var spfDomainWarning = document.getElementById("spfDomainWarning");
	spfDomainWarning.style.display = "none";
	
	// Abort any previous SPF checks, and reset the XUL elements.
	
	xmlhttp.abort();
	
	spfBox.style.display = "none";
	statusText.style.color = null;
    statusText.style.display = "none";
	
	statusLink.style.display = "none";
	statusTrust.style.display = "none";
	if (!manual) {
		goMenu.hidden = true;
		goMenuSep.hidden = true;
	}

	// If no message is being read, bail out.
	
    if (!statusText) return;
	if (GetNumSelectedMessages() != 1) return;

	if (!uri) return;
	if (uri.indexOf("news-message://") == 0) return;

	statusText.style.display = null;
	
	if (checkonload == "no" && !manual) {
		goMenu.hidden = false;
		goMenuSep.hidden = false;
		statusText.value = "Click on Verify Sender (SPF/DK) from the Tools menu.";
		return;
	}

	spfBox.style.display = null;

	// Check that a query server has been set up.  If not, display an error.
	
	if (!serverurl) {
		statusText.value = "No verification server has been configured.";
		return;
	}
	
	// Load the message service, and scan the message headers.
	// This bit is roughly based on a part of Enigmail.

	statusText.value = "Scanning message headers...";
	
    var msgService = messenger.messageServiceFromURI(uri);
    
	var consumer = Components.classes["@mozilla.org/network/sync-stream-listener;1"].createInstance();
	var consumer_inputstream = consumer.QueryInterface(Components.interfaces.nsIInputStream);
	var input = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance();
	var scriptableinput = input.QueryInterface(Components.interfaces.nsIScriptableInputStream);

	/*var async_consumer = Components.classes["@mozilla.org/network/async-stream-listener;1"].createInstance();
	var async_consumer2 = async_consumer.QueryInterface(Components.interfaces.nsIAsyncStreamListener);
	async_consumer2.init(consumer_inputstream, null);*/
	
	scriptableinput.init(consumer);
	try {
		msgService.streamMessage(uri, consumer, msgWindow, null, false, null)
	} catch (ex) {
		statusText.value = "Sender verification is not applicable for this message.";
		return;
	}
	
	var h = "";

	FromHdr = null;
	EnvFrom = null;
	DateHdr = null;
	
	HeloName = null;
	IPAddr = null;
	
	HeloName2 = null;
	IPAddr2 = null;
	
	DKHash = null;

	var mode = 0;
	var hcont = false;
	var hlast = "";
	var bytesread = 0;
	
	var DKHeader = null;
	var DKHeaderPostPosition = null;
	
	var c;
	var cs;
	var csi;

	// Read the headers character-by-character because I don't know a better way of doing this.
	var endofheaders = false;
	while (scriptableinput.available()) {
		cs = scriptableinput.read(512)
		for (csi = 0; csi < cs.length; csi++) {
		c = cs.charAt(csi);
		bytesread++;
		
		if (c == "\r") { continue; }
		if ((c == " " || c == "\t") && h == "") { hcont = true; continue; }
		
		if (c != "\n") { h += c; continue; }
		
		// end of headers
		if (h == "") { endofheaders = true; break; }
		
		// handle a continued header line
		if (hcont) {
			if (hlast == "DK") {
				DKHeader += h;
				DKHeaderPostPosition = bytesread;
			}
			
			hcont = false;
			h = "";
			continue;
		}
		
		// handle header

		hlast = "";

		// Compare the header to the regular expressions.
		
		var m;
		
		m = ReturnPathRegEx.exec(h);
		if (m) { EnvFrom = m[1].toLowerCase(); }
		
		m = FromRegEx.exec(h);
		if (m) {
			FromHdr = m[1];
			if (!FromHdr) { FromHdr = m[2]; }
			FromHdr = FromHdr.toLowerCase();
		}
		
		m = DateRegEx.exec(h);
		if (m) { DateHdr = Date.parse(m[1]); }
		
		var he = null;
		var ip = null;
		
		m = ReceivedRegEx.exec(h);
		if (m) { he = m[1]; ip = m[2]; }
		
		m = ReceivedRegEx2.exec(h);
		if (m) { ip = m[1]; he = m[2]; }
			
		m = ReceivedRegEx3.exec(h);
		if (m) { ip = m[1]; he = m[2]; }

		m = ReceivedRegEx4.exec(h);
		if (m) { ip = m[2]; he = m[3]; }

		if (he != null && ip != null) {
			var internal = 0;
			// TODO: check the fourth range: 172.16.0.0-172.31.255.255
			if (startsWith(ip, "127.0.0.") || startsWith(ip, "192.168.") || startsWith(ip, "10.")) {
				internal = 1;
			} else {
				// Check spf.host.* preferences to see if these are internal mail servers.
				var ip2 = ip;
				while (ip2 != null) {
					var prefname = "spf.host." + ip2;
					if (prefs.getPrefType(prefname) == prefs.PREF_STRING) {
						internal = (prefs.getCharPref(prefname) == "trust");
						if (internal) break;
					}
					
					// If this was a wildcard test, strip off the wildcard.
					if (endsWith(ip2, ".*")) { ip2 = ip2.substring(0, ip2.length-2); }
					
					// If there's a dot in the string, replace what's after the dot
					// with an asterisk, and continue checking.
					var dot = ip2.lastIndexOf(".");
					if (dot > 0) {
						ip2 = ip2.substring(0, dot+1) + "*";
					} else {
						// No more testing.
						ip2 = null;
					}
				}
			}
			
			if (!internal) {
				// This is the point where we should do an SPF check.
				if (mode == 0) {
					HeloName = he;
					IPAddr = ip;
				} else if (mode == 1) {
					// This gets the second matching Received: line information.
					HeloName2 = he;
					IPAddr2 = ip;
				}						
				mode++;
			}
		}
	
		if (startsWith(h, "DomainKey-Signature: ") && DKHeader == null) {
			// DKHeader != null to make sure we only read the first DK header in the message.
			DKHeader = h.substring(21, h.length);
			hlast = "DK";
			DKHeaderPostPosition = bytesread; // message hash starts from this position
		}

		h = "";
		hcont = false;
		
		}
		if (endofheaders) break;
	}
	
	scriptableinput.close();
	consumer_inputstream.close();
	
	if (SVE_GetDomain(FromHdr) == null) FromHdr = null;
	if (EnvFrom != null && SVE_GetDomain(EnvFrom) == null) EnvFrom = null;
	
	// What if there is no From: header
	if (!FromHdr) {
		statusText.value = "Cannot determine sender address from mail message.";
		statusText.style.color = "blue";
		return;
	}
	
	// If the message does not have a parseable date, flag an error.
	/*if (!DateHdr) {
		statusText.value = "Message date could not be determined.";
		return;
	}*/
	
	// If the message is old, there's no way to know whether something legitimate now
	// was legitimate when it was sent, or something illegitimate now might have
	// (confusingly) been legitimate at the time.
	if (DateHdr != null && new Date().getTime() - DateHdr > 1000*60*60*24*DAYS_TOO_OLD) {
		statusText.value = "Message is too old to verify sender.";
		return;
	}
	
	// For completeness, if a message was sent too far in the future, flag a problem.
	if (DateHdr != null && DateHdr - new Date().getTime() > 1000*60*60*24*DAYS_IN_THE_FUTURE) {
		statusText.value = "Message date is in the future.  Sender verification skipped.";
		return;
	}
	
	// When there aren't any matching Recevied: headers, the mail probably started
	// on the mail server itself.  Is this a security problem?
	if (!HeloName || !IPAddr) {
		statusText.value = "Mail appears to originate from your mail server.";
		return;
	}

	// Interpret the DK header
	if (FromHdr != null && DKHeader != null && DKHeader != "" && usedk != "no") {
		mode = 0;
		h = "";
		var v;
		
		var DK_ALGO = "rsa-sha1";
		var DK_SIG = null;
		var DK_CAN = null;
		var DK_DOMAIN = null;
		var DK_HEADERS = null;
		var DK_QMETHOD = null;
		var DK_SELECTOR = null;
		
		for (csi = 0; csi < DKHeader.length; csi++) {
			c = DKHeader.charAt(csi);
			if (c == " " || c == "\t") continue;
			if (mode == 0) {
				if (c == "=") {
					mode = 1;
					v = "";
				} else {
					h += c;
				}
			} else {
				if (c != ";")
					v += c;
				if (c == ";" || csi == DKHeader.length-1) {
					switch (h) {
						case "a": DK_ALGO = v; break;
						case "b": DK_SIG = v; break;
						case "c": DK_CAN = v; break;
						case "d": DK_DOMAIN = v.toLowerCase(); break;
						case "h": DK_HEADERS = ":" + v.toLowerCase() + ":"; break;
						case "q": DK_QMETHOD = v; break;
						case "s": DK_SELECTOR = v; break;
					}
					
					mode = 0;
					h = "";
				}
			}
		}
		
		// Check that required tags are present, and if so compute the email hash
		if (DK_SIG != null && (DK_CAN == "simple" || DK_CAN == "nofws") && DK_DOMAIN != null && DK_QMETHOD != null && DK_SELECTOR != null && (endsWith(FromHdr, "@" + DK_DOMAIN) || endsWith(FromHdr, "." + DK_DOMAIN))) {
			// Load up a new scriptable input stream
			consumer = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
				.createInstance().QueryInterface(Components.interfaces.nsIInputStream);
			input = Components.classes["@mozilla.org/scriptableinputstream;1"]
				.createInstance().QueryInterface(Components.interfaces.nsIScriptableInputStream);
			input.init(consumer);
			msgService.streamMessage(uri, consumer, msgWindow, null, false, null)
			
			// Move past the first DK header
			input.read(DKHeaderPostPosition);
			
			// Start reading the email in chunks of lines.  Both hash methods are line-based.
			mode = 0;
			var line = "";
			var hashdata = "";
			var trailingLines = "";
			hcont = false;
			hlast = null;
			
			sha1_incremental_init();
			
			while (input.available()) {
				cs = input.read(512);
				
				// Ensure the email ends with a new line so the last line
				// is proceesed.
				if (!input.available() && !endsWith(cs, "\n"))
					cs += "\n";
				
				for (csi = 0; csi < cs.length; csi++) {
					c = cs.charAt(csi);
					
					if (mode == 0 && line == "" && (c == "\t" || c == " "))
						hcont = true;
					
					// Remove folding whitespace
					if (DK_CAN == "nofws" && (c == "\t" || c == " ")) continue;
					
					if (c == "\r") { continue; }
					if (c != "\n") { line += c; continue; }
					
					// We've reached the end of a line
					
					var skipLine = false;
					
					// If the "h" tag is used, only those header lines (and their
					// continuation lines if any) added to the "h" tag list are
					// included.
					if (mode == 0 && DK_HEADERS != null && line != "") {
						// What is the header of this line.
						var header;
						if (hcont) {
							header = hlast;
						} else {
							var colon = line.indexOf(":");
							header = line.substring(0, colon).toLowerCase();
							hlast = header;
						}
						
						if (DK_HEADERS.indexOf(":" + header + ":") == -1) {
							// skip this header
							skipLine = true;
						}
					}
					
					line += "\r\n";
					
					// Trailing empty lines are ignored.  They are added back
					// the next time we have data.
					if (line == "\r\n") {
						skipLine = true;
						trailingLines += line;
					}
					
					if (!skipLine) {
						// We have data, so any lines buffered that might have been trailing
						// are taken out of the buffer and put into the hashdata.
						hashdata += trailingLines;
						trailingLines = "";

						if (DK_CAN == "nofws" && mode == 0 && hcont && hashdata.length >= 2) {
							// Header continuation lines are unwrapped so that header lines are
							// processed as a single line.  This involves double-backing on
							// hashdata: removing the last line ending.
							hashdata = hashdata.substring(0, hashdata.length-2);
						}
					
						hashdata += line;
					}
						
					// Don't feed the hash algorithm in the header section because
					// with the nofws method, hashdata changes when there are header
					// continuation lines.  Also, ensure there is data left in hashdata
					// after this so that it can be used at the very end to close
					// the hash computation.
					while (mode == 1 && hashdata.length > (64*12)) {
						var hasharg = hashdata.substring(0, (64*12));
						hashdata = hashdata.substring(hasharg.length, hashdata.length);
						sha1_incremental_block(hasharg, false);
						//alert(hasharg);
					}
					
					// end of headers
					if (mode == 0 && line == "\r\n") { mode = 1; }
					
					line = "";
					hcont = false;
				}
			}

			if (hashdata.length > 0) {
				sha1_incremental_block(hashdata, true);
				//alert(hashdata);
			}
			
			DKHash = sha1_incremental_end_base64();
			//alert(DKHash);
			
			// Close the stream
			input.close();
		}
	}

	
	// Run the query.
	
	SVE_QuerySPF(HeloName, IPAddr,
		FromHdr, EnvFrom != null && EnvFrom != FromHdr ? EnvFrom : null,
		DKHash == null ? null : DKHeader, DKHash,
		"spfGo2()");
		
	//SVE_CheckForLookAlikes(SVE_GetDomain(FromHdr));
}

function spfGo2() {	
	var prefname = "spf.forwarder." + QueryReturn.domain;
	var domainTrusted = (prefs.getPrefType(prefname) == prefs.PREF_STRING && prefs.getCharPref(prefname) == "trust");

	// If it was the envelope address that passed, if that domain is trusted, and if we have
	// further Received: header information, then this is a trusted forwarder.
	if (HeloName2 && IPAddr2 && EnvFrom
		&& QueryReturn.result == "pass"
		&& !endsWith(FromHdr, "@" + QueryReturn.domain)
		&& endsWith(EnvFrom, "@" + QueryReturn.domain)) {
		if (domainTrusted) {
			QueryReturn2 = QueryReturn;
			SPFSendQuery(HeloName2, IPAddr2, FromHdr, null, null, null, "spfGo3()", "forward check");
			return;
		} else {
			QueryReturn.promptToTrust = 1;
		}
	}
	
	spfGoFinish();
}

function spfGo3() {
	QueryReturn.trustedForwarder = QueryReturn2.domain;
	spfGoFinish();
}

function spfGoFinish() {	
	// Set up the explanation label.
	statusLink.style.display = null;
	if (QueryReturn.comment == "")
		statusLink.value = "No explanation is available for this message.";
	else
		statusLink.value = QueryReturn.comment;

	// When the sender is not verified and the forwarder is not trusted, then
	// show the internal network server link.
	if (QueryReturn.result != "pass" && QueryReturn.method != "surbl" && QueryReturn.result != "none"
		&& !QueryReturn.trustedForwarder) {
			
		reverseDNS(IPAddr, function(hostnames) {
			if (hostnames == null || hostnames.length == 0) return;
			statusTrust.style.display = null;
			statusTrust.childNodes[0].nodeValue = "Is " + hostnames[0] + " in your network?";
			statusTrust.linktype = "mta";
			statusTrust.mta = IPAddr;
			statusTrust.reversedns = hostnames[0];
		});
	}
	
	// Show the user the result of the query.
	
	switch (QueryReturn.result) {
		case "pass":
			if (endsWith(FromHdr, "@" + QueryReturn.domain)) {
				statusText.value = "Sending Domain <" + QueryReturn.domain + "> Verified";
				statusText.style.color = null;
			} else {
				statusText.value = "Envelope Domain <" + QueryReturn.domain + "> Verified (From: Address Unverified)";
				statusText.style.color = "red";

				if (QueryReturn.promptToTrust) {
					statusTrust.style.display = null;
					statusTrust.linktype = "forwarder";
					statusTrust.mta = QueryReturn.domain;
					statusTrust.childNodes[0].nodeValue = "Is " + QueryReturn.domain + " a mail list?";
					return;
				}
			}
			
			if (QueryReturn.trustedForwarder)
				statusText.value += " (via " + QueryReturn.trustedForwarder + ")";
			if (QueryReturn.method == "spf")
				statusText.value += " [SPF]";
			if (QueryReturn.method == "dk")
				statusText.value += " [DomainKeys]";
			break;
		case "fail":
			statusText.value = "This does not appear to be a legitimate <" + QueryReturn.domain + "> email.";
			statusText.style.color = "red";
			break;
		case "none":
			statusText.value = "Sending domain does not support verification.  (Address could be forged.)";
			statusText.style.color = "blue";
			break;
		case "neutral":
			statusText.value = "Sender cannot be verified by domain.  (Address could be forged.)";
			statusText.style.color = "blue";
			break;
		case "spamming":
		case "phishing":
			statusText.value = QueryReturn.comment;
			statusText.style.color = "red";
			statusLink.value = "This is reported by www.surbl.org.";
			break;
		default:
			statusText.value = "Error: " + QueryReturn.comment;
			statusText.style.color = "red";
			break;
	}
	
	if (warnunverified && QueryReturn.result != "pass") {
		alert("The sending domain of this email could not be verified.  It is advised that you do not reply to this email, download any attachments, or follow any links in the email.\n\nThis warning can be turned off by going to the Sender Verification Exception options window, which can be found in Tools -> Extensions.");
	}
}

function SVE_QuerySPF(helo, ip, email_from, email_envelope, dkheader, dkhash, func) {
	// Query the email from: first.  If that doesn't pass,
	// then query the email envelope.  If that also doesn't
	// pass, then go with the result of the from: query.
	
	statusText.value = "Performing SPF verification...";
	
	// Check mailpolice's fraud list.
	queryDNS(
		SVE_GetDomain(email_from) + ".fraud.rhs.mailpolice.com",
		"A",
		function(addr) {
			if (addr != null)
				alert("The domain <" + SVE_GetDomain(email_from) + "> is listed in the MailPolice fraud blocklist.  It is likely this message was written with malicious intensions.  It is advised that you do not reply or open any links in the email.");
		});
	
	
	// Remember what message we're looking at now.  If the
	// user moves on to another message while we're waiting
	// for some asynchronous operation to finish, discard
	// the result when the operation finishes.
	var curMessage = GetFirstSelectedMessage();
	
	SPF(ip, SVE_GetDomain(email_from),
		function(result) {
			if (curMessage != GetFirstSelectedMessage())
				return;
			
			if (result.status == "+" || email_envelope == null)
				SVE_QuerySPF2(result.status, result.message, result.isguess, SVE_GetDomain(email_from), helo, ip, email_from, email_envelope, dkheader, dkhash, func);
			else
				SPF(ip, SVE_GetDomain(email_envelope),
					function(result2) {
						if (curMessage != GetFirstSelectedMessage())
							return;
						
						if (result2.status == "+")
							SVE_QuerySPF2(result2.status, result2.message, result2.isguess, SVE_GetDomain(email_envelope), helo, ip, email_from, email_envelope, dkheader, dkhash, func);
						else
							SVE_QuerySPF2(result.status, result.message, result.isguess, SVE_GetDomain(email_from), helo, ip, email_from, email_envelope,  dkheader, dkhash, func);
					});
		});
}

function SVE_QuerySPF2(result, message, isguess, domain, helo, ip, email_from, email_envelope, dkheader, dkhash, func) {
	// If the SPF test didn't pass, and if there is DK information,
	// then send a query to the query server.
	if (result != "+" && dkheader != null && dkhash != null) {
		SPFSendQuery(helo, ip, email_from, email_envelope, dkheader, dkhash, func);
		return;
	}
	
	if (result == "+") result = "pass";
	else if (result == "-") result = "fail";
	else if (result == "~") result = "fail";
	else if (result == "?") result = "unknown";
	else if (result == "0") result = "none";
	else result = "error";
	
	QueryReturn = new Object();
	QueryReturn.result = result;
	QueryReturn.comment = message;
	QueryReturn.domain = domain;
	QueryReturn.method = "spf";
	setTimeout(func, 1);
}

function SVE_GetDomain(emailaddress) {
	var at = emailaddress.indexOf("@");
	if (at == -1) return null;
	return emailaddress.substr(at+1);
}

function SPFSendQuery(helo, ip, email_from, email_envelope, dkheader, dkhash, func) {
	// Prepare the URL of the query.
	
	var url = serverurl;
	url += "?agent=" + useragent;
	url += "&helo=" + helo + "&ip=" + ip;
	
	if (email_from != null)
		url += "&from=" + email_from;

	if (email_envelope != null)
		url += "&envfrom=" + email_envelope;
	
	var url_nodk = url;
	
	if (dkheader != null && dkhash != null) {
		url += "&domainkeys_header=" + dkheader;
		url += "&domainkeys_hash=" + dkhash;
	}
	
	//throw url;
	
	// If the result is cached, use that without going to the server.
	for (var i = 0; i < QueryCache.length; i++) {
		if (QueryCache[i] == null) continue;
		if (QueryCache[i].querystring == url
			|| (QueryCache[i].method == 'spf' && QueryCache[i].querystring_nodk == url_nodk)) {
				
			// If this was an SPF result that doesn't indicate a pass, but there is a DK
			// sigature on this email, then the sig might still pass the email, so don't
			// use the cached result.
			if (QueryCache[i].method == 'spf' && QueryCache[i].result != 'pass' && dkheader != null) continue;
				
			QueryReturn = QueryCache[i];
			window.setTimeout(func, 1);
			return;
		}
	}
	
	// Build the query object
	var queryObj = new QueryRet(url, url_nodk);
	
	// Query the server.

	var curMessage = GetFirstSelectedMessage();
	
	statusText.value = "Contacting verification server...";
	
	xmlhttp.open("GET", url, true);
	xmlhttp.onerror=function() {
		statusText.value = "Error verifying sender: " + xmlhttp.statusText;
		statusText.style.color = "blue";
	};
	xmlhttp.onload = function() {
		if (GetFirstSelectedMessage() != curMessage) return;
		SPFSendQuery2(func, queryObj);
	};
	xmlhttp.send(null);
}

function SPFSendQuery2(func, queryObj) {	
	// Don't know how better to get the information out of the XML...
	
	if (xmlhttp.responseXML == null) {
		statusText.value = "There was a server error.";
		statusText.style.color = "blue";
		return;
	}
	
	var e = xmlhttp.responseXML.documentElement.firstChild;
	while (e && e.nodeName != "response") {
		e = e.nextSibling;
	}
	if (!e) {
		statusText.value = "Server error.";
		statusText.style.color = "blue";
		return;
	}
	
	e = e.firstChild;
	while (e) {
		if (e.nodeName == "result") { queryObj.result = e.textContent; }
		if (e.nodeName == "comment") { queryObj.comment = e.textContent; }
		if (e.nodeName == "domain") { queryObj.domain = e.textContent; }
		if (e.nodeName == "method") { queryObj.method = e.textContent; }
		
		if (e.nodeName == "change-server") {
			if (confirm("Your current query server requests that you begin using the query server at <" + e.textContent + ">.  The request is most likely to ease the load placed on the current server.  Is this switch okay?")) {
				prefs.setCharPref("spf.queryserver", e.textContent);
			}
		}
		
		e = e.nextSibling;
	}

	// Return
	QueryReturn = queryObj;
	
	// Cache the return value.
	QueryCache[QueryCacheNext++] = queryObj;
	if (QueryCacheNext == QueryCacheMax) QueryCacheNext = 0;
	
	// Call the callback
	window.setTimeout(func, 1);
}

function SVE_CheckForLookAlikes(domain) {
	SVE_CheckForLookAlikesIDN(domain);
	
	var warned = new Object();
	SVE_CheckForLookAlikesMutations(domain, warned);
}

function SVE_CheckForLookAlikesIDN(domain) {
	for (var i = 0; i < domain.length; i++) {
		if (domain.charCodeAt(i) >= 128) {
			SVE_ShowDomainWarning("Warning: The domain of this email <" + domain + "> has extended characters in it that may cause it to have the same appearance as the usual <" + domain + ">, although the domain of this email is different.");
			return;
		}
	}
}

function SVE_CheckForLookAlikesMutations(domain, warned) {
	var nc;
	for (var i = 0; i < domain.length; i++) {
		if (domain.charAt(i) == "i" || domain.charAt(i) == "I") {
			SVE_CheckForLookAlikesMutations2(domain, i, "l", warned);
			SVE_CheckForLookAlikesMutations2(domain, i, "1", warned);
		}
		if (domain.charAt(i) == "l" || domain.charAt(i) == "L") {
			SVE_CheckForLookAlikesMutations2(domain, i, "i", warned);
			SVE_CheckForLookAlikesMutations2(domain, i, "1", warned);
		}
		if (domain.charAt(i) == "1") {
			SVE_CheckForLookAlikesMutations2(domain, i, "i", warned);
			SVE_CheckForLookAlikesMutations2(domain, i, "l", warned);
		}
		if (domain.charAt(i) == "o") {
			SVE_CheckForLookAlikesMutations2(domain, i, "0", warned);
		}
		if (domain.charAt(i) == "0") {
			SVE_CheckForLookAlikesMutations2(domain, i, "o", warned);
		}
	}
}
function SVE_CheckForLookAlikesMutations2(domain, i, c, warned) {
	var dom2 = domain.substr(0, i) + c + domain.substr(i+1);
	queryDNS(dom2, "A",
		function(resolved) {
			if (resolved == null || resolved.length == 0) return;
			if (warned.warned) return;
			warned.warned = true;
			SVE_ShowDomainWarning("Warning: The domain of this email <" + domain + "> is similar to the domain <" + dom2 + ">.");
		});
}

function SVE_ShowDomainWarning(warning) {
	var spfDomainWarning = document.getElementById("spfDomainWarning");
	spfDomainWarning.style.display = null;
	spfDomainWarning.value = warning;
}

function QueryRet(querystring, querystring_nodk) {
	this.querystring = querystring;
	this.querystring_nodk = querystring_nodk;
}

function MyUrlListener() {
	this.OnStartRunningUrl = function(url) { alert("Start" + url); }
	this.OnStopRunningUrl = function(url, status) { alert("Stop " + staus + ": " + url); }
}

function startsWith(a, b) {
	if (b.length > a.length) return false;
	return a.substring(0, b.length) == b;
}
function endsWith(a, b) {
	if (b.length > a.length) return false;
	return a.substring(a.length-b.length) == b;
}


