/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/*
Description:


Manual:


Version:
29.03.24
20:59

*/

var startTime, path, panorama, startLoc, currentLatLong, 
	tempControlUI, mapClickListener, secondsGameDuration, gameDurationText;
let map, guessMarker, targetMarker, targetPath, replyText, xmlRegions;
var panoServiceRadius = 100000;
var currentCountry = "";
var currentRegion = "";
var hasSubmitted = Boolean(false);
var pointsAchieved = +0;
var distanceToTarget;
var maxPoints = 1000;

const zeroPosition = { lat: 0, lng: 0 };

//var xmlString = '<?xml version="1.0" encoding="UTF-8" ?><regions><region name="Austria"><shortCountryNames><Austria>AT</Austria></shortCountryNames><mapCenter><lat>47.50980551122986</lat><lng>13.169714878983603</lng></mapCenter><mapZoom>4</mapZoom><rectangleBounds><north>49.036864010687246</north><east>17.215430682700493</east><south>46.34766220473346</south><west>9.506080096763027</west></rectangleBounds></region><region name="Germany"><shortCountryNames><Germany>DE</Germany></shortCountryNames><mapCenter><lat>50.71909267478724</lat><lng>10.73075002222777</lng></mapCenter><mapZoom>4</mapZoom><rectangleBounds><north>54.92626188567992</north><east>15.075843280356741</east><south>47.25199367794615</south><west>5.858619159263028</west></rectangleBounds></region></regions>';


async function initPano() {
	const { Map } = await google.maps.importLibrary("maps");
	const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
	const { Geometry } = await google.maps.importLibrary("geometry");
	
	
	//Load regions XML file
	fetch('./regions.xml')
		.then((response) => response.text())
		.then((xmlString) => {
			let parser = new DOMParser();
			xmlRegions = parser.parseFromString(xmlString, "application/xml");
	});
	
	//Add isSelected = "" as attribute to each region element
	for (let iCount = 0; iCount < xmlRegions.getElementsByTagName("region").length; iCount++) {
		xmlRegions.getElementsByTagName("region")[iCount].setAttribute("isSelected", "");
	}
	
	//For testing: Select regions "Germany" + "Austria"
	//xmlRegions.getElementsByTagName("region")[1].setAttribute("isSelected", "Yes");
	//xmlRegions.getElementsByTagName("region")[0].setAttribute("isSelected", "Yes");
	
	newSpot();
	
	//Create map for guessing
	map = new Map(document.getElementById("map"), {
  		center: zeroPosition,
    	zoom: 1,
    	mapTypeControlOptions: {
    		mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain']
    	},
    	disableDefaultUI: true,
		mapId: "f0133ed91e943e1c",
		draggableCursor: 'default',
  	});
	
	
	//Create StreetView panorama
	panorama = new google.maps.StreetViewPanorama(
		document.getElementById("pano"),
    	{
      	position: zeroPosition,
      	addressControl: false, //address box (top left corner of panorama)
      	linksControl: true, //arrows for navigation
      	panControl: true, //compass
      	enableCloseButton: false, //button (left arrow in top left corner of panorama) for going back
      	disableDefaultUI: false,
    	},
	);
	
	
	//Create "New Game" control button in top right corner of panorama
	var newGameControlDiv = document.createElement("div");
	tempControlUI = createControl(newGameControlDiv, 
		"New Game Session", "New Game", "5px", "25px", "", "");
	tempControlUI.addEventListener("click", () => {
  		newSpot();
	});
	panorama.controls[google.maps.ControlPosition.TOP_RIGHT].push(newGameControlDiv);
	
	//Create "Select regions" control button at top center of panorama
	var selectRegionsControlDiv = document.createElement("div");
	tempControlUI = createControl(selectRegionsControlDiv, 
		"Select regions", "Select regions", "5px", "25px", "", "20px");
	tempControlUI.addEventListener("click", () => {
  		selectRegions();
	});
	panorama.controls[google.maps.ControlPosition.TOP_RIGHT].push(selectRegionsControlDiv);
	
	
	//Create "Submit" control button in top left corner of map
	var submitControlDiv = document.createElement("div");
	tempControlUI = createControl(submitControlDiv, "Submit", "Submit", "3px", "16px", "", "");
	tempControlUI.addEventListener("click", () => {
  		submitGuess();
	});
	map.controls[google.maps.ControlPosition.TOP_LEFT].push(submitControlDiv);
	
	
	map.setStreetView(panorama);
	
	
	//Create PinElement for guessMarker
	const pinGuessMarker = new PinElement({
  		scale: 0.7,
		background: "#1A3CD5",
		borderColor: "black",
		glyphColor: "black",
  	});
    
	//Create marker for guessing
	guessMarker = new AdvancedMarkerElement({
    	map: map,
    	position: { lat: 0, lng: 0 },
		title: "My guess",
		content: pinGuessMarker.element,
  	});
	
	/*
	//legacy marker (old version)
	guessMarker = new google.maps.Marker ({
  		map: map,
		position: {lat: 0, lng: 0},
		title: "My guess",
  	});
  	*/
	
	mapClickListener = google.maps.event.addListener(map, 'click', function(event) {
  		moveMarker(event.latLng);
	});
	
}


//window.initPano = initPano;

initPano();

async function newSpot() 
{
	const { Map } = await google.maps.importLibrary("maps");
	
	let northernBound, easternBound, southernBound, westernBound;
	let randomLat, randomLng;
	
	startTime = new Date().getTime();
    try {
		//Reset targetMarker + targetPath, i.e. hide them from map
        targetMarker.setMap(null);
        targetMarker = null;
        targetPath.setMap(null);
        targetPath = null;		    
    }
    catch(err) {}
    finally {
        //Calculate number of selected regions
		var numRegionsSelected = xmlRegions.querySelectorAll('region[isSelected=Yes]').length;
		//console.log(numRegionsSelected);
		
		
		
		if (numRegionsSelected > 0) {
			//Randomly choose one of the selected regions
			var randomRegion = Math.floor(Math.random() * ((numRegionsSelected - 1) + 1));
			//console.log(randomRegion);
			
			//Randomly choose one of the countries in the chosen region
			var numberOfCountries = xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.querySelector("shortCountryNames").childElementCount;
			var randomCountry = Math.floor(Math.random() * ((numberOfCountries - 1) + 1));
			//console.log(randomCountry);
			
			//Get rectangle bounds from chosen region
			northernBound = parseFloat(xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.getElementsByTagName("north")[0].textContent);
			easternBound = parseFloat(xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.getElementsByTagName("east")[0].textContent);
			southernBound = parseFloat(xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.getElementsByTagName("south")[0].textContent);
			westernBound = parseFloat(xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.getElementsByTagName("west")[0].textContent);
			
			/*
			console.log(northernBound);
			console.log(easternBound);
			console.log(southernBound);
			console.log(westernBound);
			*/
			
			randomLat = getRandomLatBetween(southernBound, northernBound);
			randomLng = getRandomLngBetween(westernBound, easternBound);
			
			//Set currentCountry to short_name of randomly chosen country
			currentCountry = xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.querySelector("shortCountryNames").children[randomCountry].textContent;
			//console.log(currentCountry);
			
			//Set currentRegion to name attribute of randomly chosen region
			currentRegion = xmlRegions.querySelectorAll('region[isSelected=Yes]')[randomRegion]
				.getAttribute("name");
			//console.log(currentRegion);
			
			//Set radius for StreetView Service to 3000 m
			panoServiceRadius = 3000;
		} else { //Generate worldwide random location
			randomLat = getRandomLatLng(90);
			randomLng = getRandomLatLng(180);
			
			//Set currentCountry and currentRegion to empty string
			currentCountry = "";
			currentRegion = "";
			
			//Set radius for StreetView Service to 100000 m = 100 km
			panoServiceRadius = 100000;
		}
				
				
		//console.log(randomLatInsideRect + ', ' + randomLngInsideRect);
		
		var sv = new google.maps.StreetViewService();
        sv.getPanorama({location: {lat: randomLat, lng: randomLng}, preference: 'best', radius: panoServiceRadius, source: 'outdoor'}, processSVData);
        
		//Set hasSubmitted = false to verify that the Submit button has not been clicked during current game instance
		hasSubmitted = false;
    }
}

function processSVData(data, status) 
{
    if (status === 'OK') {
        var geocoder = new google.maps.Geocoder();
		
		if(currentRegion.length > 0) {
			//Reverse geocoding request to retrieve country information for chosen panorama location
			geocoder
			.geocode({ location: data.location.latLng })
			.then((result) => {
				const { results } = result;
				
				var isCorrectCountry = false;
				
				for (let iResult = 0; iResult < results.length; iResult++) {		
					if(results[iResult].address_components[0].types[0].includes("country")) {
						if(results[iResult].address_components[0].short_name == currentCountry) {
							isCorrectCountry = true;
						}
					}
				}
				
				if(isCorrectCountry) {
					//console.log("Country OK!");
					
					//Set click listener again for moving guessMarker
					mapClickListener = google.maps.event.addListener(map, 'click', function(event) {
  						moveMarker(event.latLng);
  					});
				
					//center map at position for currentRegion specified in XML file + set zoom as specified
					var mapCenter = {
						lat: parseFloat(xmlRegions.querySelector('region[name=' + currentRegion + ']')
							.querySelector('mapCenter').querySelector('lat').textContent),
						lng: parseFloat(xmlRegions.querySelector('region[name=' + currentRegion + ']')
							.querySelector('mapCenter').querySelector('lng').textContent)
					}
					map.setCenter(mapCenter);
					map.setZoom(parseInt(xmlRegions.querySelector('region[name=' + currentRegion + ']')
							.querySelector('mapZoom').textContent));
					
					//set guessMarker position to map center
					guessMarker.position = mapCenter;
					
					//Set panorama to new location
					panorama.setPano(data.location.pano);
        			startLoc = data.location.latLng;
					
				} else { //If country is not coorect, generate new random location
					//console.log("Wrong Country!");
					newSpot();
				}
			})
			.catch((e) => {
				console.log("Geocode was not successful for the following reason: " + e);
			});
		} else {
			//Set click listener again for moving guessMarker
			mapClickListener = google.maps.event.addListener(map, 'click', function(event) {
  				moveMarker(event.latLng);
  			});
			
			//center map at {lat: 0, lng: 0} and reset zoom to 1
			map.setCenter(zeroPosition);
			map.setZoom(1);
			
			//reset guessMarker position to {lat: 0, lng: 0}
			guessMarker.position = zeroPosition;
			
			//Set panorama to new location
			panorama.setPano(data.location.pano);
        	startLoc = data.location.latLng;
		}
    } else 
        newSpot();
}

function getRandomLatLng(max) 
{
    var num = Math.random() * Math.floor(max);
    if(Math.random() > 0.5) num = num * -1;
    return num;
}

function createControl(controlDiv, desc, content, bSize, fSize, marginL, marginR) 
{
    // Set CSS for the control border.
    const controlUI = document.createElement("div");
    controlUI.style.backgroundColor = "#fff";
    controlUI.style.border = bSize + " solid #fff";
    controlUI.style.borderRadius = "3px";
    controlUI.style.boxShadow = "0 2px 6px rgba(0,0,0,.3)";
    controlUI.style.cursor = "pointer";
    controlUI.style.marginBottom = "22px";
	controlUI.style.marginLeft = marginL
	controlUI.style.marginRight = marginR;
    controlUI.style.textAlign = "center";
    controlUI.title = desc;
    controlDiv.appendChild(controlUI);
	
    // Set CSS for the control interior.
    const controlText = document.createElement("div");
    controlText.style.color = "rgb(25,25,25)";
    controlText.style.fontFamily = "Comic Sans MS,Arial,sans-serif";
    controlText.style.fontSize = fSize;
    controlText.style.lineHeight = "20px";
    controlText.style.paddingLeft = "5px";
    controlText.style.paddingRight = "5px";
    controlText.innerHTML = content;
    controlUI.appendChild(controlText);
    return controlUI;
}

function moveMarker(pnt) 
{
    guessMarker.position = pnt;
}

async function submitGuess()
{
	const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
	
	//var gameDurationText = formatTime((new Date().getTime() - startTime) / 1000);
	var panPosition = panorama.getPosition();
	var guessMarkerPosition = guessMarker.position;
	
	if (hasSubmitted === false) {
		secondsGameDuration = (new Date().getTime() - startTime) / 1000;
		gameDurationText = formatTime(secondsGameDuration);
	}
	
	try {
		//Remove click listener so that guessMarker cannot be moved until new game starts
        google.maps.event.clearListeners(map, 'click');
		
		//Reset targetMarker + targetPath
		targetMarker.setMap(null);
        targetMarker = null;
        targetPath.setMap(null);
        targetPath = null;			
    }
    catch (err) {
	
	}
	finally {
		var distanceText = "";
		
		//If Submit button has been clicked for the first time during current game instance, calculate distanceToTarget and pointsAchieved
		if (hasSubmitted === false) {
			distanceToTarget = google.maps.geometry.spherical.computeDistanceBetween(
    			panPosition,
    			guessMarkerPosition
			);
			
			pointsAchieved = calculatePoints(distanceToTarget, secondsGameDuration);
		}
				
		
		if (distanceToTarget < 1000) {
			distanceText = distanceToTarget.toFixed(2) + " m";
		}
		else {
			distanceText = (distanceToTarget/1000).toFixed(3) + " km";
		}
		
		var colourPointsText;
		
		if (pointsAchieved < 500) {
			//Red text for points
			colourPointsText = "#E00D0D";
		} else if (pointsAchieved < 850) {
			//Orange text for points
			colourPointsText = "#E8AF09";
		} else {
			//Green text for points
			colourPointsText = "#2DDF09";
		}
				
		
		replyText = '<div id="result">'+'<b>Result:</b><br>Distance: '  + distanceText + '<br>' + 'Time: ' + gameDurationText + '<br><b style="color: ' + colourPointsText + '">Points: ' + pointsAchieved + ' / ' + maxPoints + '</b></div>';
		
		
		//Create PinElement for targetMarker
  		const pinTargetMarker = new PinElement({
			scale: 0.7,
			background: "#1CEC12",
			borderColor: "black",
			glyphColor: "black",
  		});
		
		//Create marker for showing target
		targetMarker = new AdvancedMarkerElement ({
  			map: map,
			position: panPosition,
			draggable: false,
			title: "Target",
			content: pinTargetMarker.element,
  		});
		
		//Set path coordinates (guess -> target)
		var pathCoordinates = [
            targetMarker.position,
            guessMarker.position
        ];
		
		//Create path
		targetPath = new google.maps.Polyline({
        	path: pathCoordinates,
            geodesic: true,
            strokecolor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });
		
		targetPath.setMap(map);
		
		//Show result popup
        displayPopup(replyText, map, targetMarker);
		
		//Set hasSubmitted = true, to see if the Submit button has been clicked before during current game instance
		hasSubmitted = true;
		
	}
}

function formatTime(seconds) {
    var timeString;
    if (seconds < 60) 
        timeString = seconds.toFixed(2) + " s"
    else if (seconds < 3600)
        timeString = Math.floor(seconds/60) +  " m " + (seconds%60).toFixed(2) + " s";
    else
        timeString = Math.floor(seconds/3600) +  " h" + (seconds%3600).toFixed(2) + " m" + ((seconds%3600)%60).toFixed(2) + " s";
    return timeString
}

function displayPopup(contentString, map, marker)
{
        var infoWindow = new google.maps.InfoWindow({
            content: contentString,
        });
    infoWindow.open(map, marker);
}

function calculatePoints(iDistance, iTime) {	
	if ((iDistance <= 70) & (iTime <= 30)) {
		return maxPoints;
	} else {
		return (1000 * (1 - distMultiplier(iDistance)) * (1 - timeMultiplier(iTime))).toFixed(0);
	}
}

function distMultiplier(iDistance) {
	var minProximity = 70;
	var maxDistance = 8000000;
	
	if (iDistance <= minProximity) {
		return 0;
	} else if (iDistance > maxDistance) {
		return 1;
	} else {
		//Linear function
		//return (1/(maxDistance - minProximity)) * (iDistance - minProximity);
		
		//Geometric function
		return ((iDistance - minProximity) / (8000000 - minProximity)) ** (1 / 1.5);
	}
}

function timeMultiplier(iTime) {
	var minQuickness = 5;
	var maxTime = 1800;
	
	if (iTime <= minQuickness) {
		return 0;
	} else if (iTime >= maxTime) {
		return 1;
	} else {
		//Linear function
		//return (1/(maxTime - minQuickness)) * (iTime - minQuickness);
		
		//Geometric function
		//return ((iTime - minQuickness) / (maxTime - minQuickness)) ** (1/3);
		
		//Arctan function
		return (1/2) * Math.atan((iTime - (maxTime + minQuickness) / 2) / (((maxTime - minQuickness) / 2) / Math.tan(1))) + 0.5;
	}
}

function getRandomLatBetween(southernLat, northernLat) {
	if (southernLat  > northernLat) {
		console.assert(!(southernLat  > northernLat), "SOUTHERN LAT MUST BE SMALLER THAN NORTHERN LAT!");
		return 0;
	}
	
	var latRange = Math.abs(northernLat - southernLat);
	
	var randomAddend = Math.random() * latRange;
	
	return southernLat + randomAddend;
}

function getRandomLngBetween(westernLng, easternLng) {
	if (easternLng == westernLng) {
		return 0;
	} else if (easternLng < westernLng) { //If easternLng < westernLng, range overlaps 180th meridian
		var lngRange = (180 - westernLng) + Math.abs(easternLng - (-180));
		
		var randomAddend = Math.random() * lngRange;

		//Calculate new (random) longitude depending on whether given (westernLng, easternLng) range overlaps 180th meridian 
		if ((westernLng + randomAddend) == 180) {
			return 180;
		} else if ((westernLng + randomAddend) < 180) {
			return westernLng + randomAddend;
		} else if ((westernLng + randomAddend) > 180) {
			return (-180 + ((westernLng + randomAddend) - 180));
		} else {
			console.log("Invalid calculation in getRandomLngBetween()!");
		}
	} else { //If easternLng > westernLng, range does not overlap 180th meridian
		var lngRange = Math.abs(easternLng - westernLng);
		
		var randomAddend = Math.random() * lngRange;
		
		return westernLng + randomAddend;
	}	
}

function selectRegions() {	
	var regionsWin = window.open('./regions.html', "Select regions", "width=600, height=600, left=300, top=100 " +
		", menubar=no, toolbar=no, location=no, status=no, resizable=no, scrollbars=no");
	
	//Wait until windows has finished loading; otherwise, all edits will be overridden
	regionsWin.onload = function() {
		//Create or empty body element
		var bodyElement = regionsWin.document.createElement("body");
		regionsWin.document.body = bodyElement;
		bodyElement = regionsWin.document.body;
		bodyElement.setAttribute("style", "background-color: #FAD7A0");
		
		//Create fieldset
		bodyElement.insertAdjacentHTML('beforeend', '<div id=regionsDiv></div>');
		
		var regionsDiv = regionsWin.document.getElementById('regionsDiv');
		
		regionsDiv.insertAdjacentHTML('beforeend', '<form id=regionsForm action=""><fieldset id=regionsFieldset>' +
			'<legend style="color: #5D6D7E; font-size: 40px; font-weight: bold">Select regions:</legend></fieldset></form>');
		
		var fieldsetElement = regionsWin.document.getElementById('regionsFieldset');
		
		//For each region in XML data, create a checkbox
		for (var regionElement of xmlRegions.getElementsByTagName('region')) {
			var regionName = regionElement.getAttribute('name');
			
			fieldsetElement.insertAdjacentHTML('beforeend', '<div id=checkboxDiv><input type="checkbox" id="' + 
				regionName + '" name="' + regionName + '" /><label for="' + 
				regionName + '">' + regionName + '</label></div>');
		}
		
		//Create Save button
		fieldsetElement.insertAdjacentHTML('beforeend', '<br><div><button type="submit" style="font-size: 20px; border-radius: 4px; padding: 5px 25px;">Save</button></div>');
		
		//Set custom submit procedure to set regions
		var formElement = regionsWin.document.getElementById('regionsForm');
		
		formElement.addEventListener("submit", (e) => {
  			e.preventDefault();
			
			//Set isSelected for each region according to checkboxes
			for (var inputElement of regionsWin.document.querySelectorAll('input[type=checkbox]')) {
				//console.log(inputElement.getAttribute('name'));
				
				//xmlRegions.getElementsByTagName("region")[1].setAttribute("isSelected", "Yes");
				if (inputElement.checked) {
					xmlRegions.querySelector('region[name=' + inputElement.getAttribute('name') + ']').setAttribute("isSelected", "Yes");
				} else {
					xmlRegions.querySelector('region[name=' + inputElement.getAttribute('name') + ']').setAttribute("isSelected", "");
				}
			}
		
			regionsWin.close();
		
			newSpot();
		
		});
	
	}
	
}
