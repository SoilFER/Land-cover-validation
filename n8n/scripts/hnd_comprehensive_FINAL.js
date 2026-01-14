// HND COMPREHENSIVE TRANSFORMATION - Honduras Data Processor
// Handles array-based landcover structure (similar to GTM)
// Photo paths: landscape_description/land_feature_photos
// Supports: vegetated (with percentages) and non-vegetated components

function parsePercentage(value) {
    if (!value) return 0;
    const str = String(value);
    if (str.includes('_')) {
        const parts = str.split('_').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            // Return MAX value, not average
            return parts[1];
        }
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function generateImageName(uuid, aspect, originalFilename) {
    if (!originalFilename) return '';
    // Extract UUID without 'uuid:' prefix if present
    const cleanUuid = uuid.replace('uuid:', '');
    return `${cleanUuid}-${aspect.toLowerCase()}.jpg`;
}

const inputItem = $input.all()[0];
if (!inputItem) return [];

const rawJson = inputItem.json;

let items = [];
if (rawJson.results && Array.isArray(rawJson.results)) {
    items = rawJson.results;
} else if (Array.isArray(rawJson)) {
    items = rawJson;
} else {
    items = [rawJson];
}

const processedItems = [];

for (const data of items) {
    const uuid = data['meta/instanceID'] || data['_uuid'];
    const countryCode = 'HND';
    const submissionTime = data['_submission_time'];

    const siteId = data['soilFER_collect/soil_description_sampling/Site_identification/site_id'] || 'UNKNOWN_SITE';
    const psu = data['soilFER_collect/soil_description_sampling/Site_identification/psu'] || '';
    const psuId = psu ? `${countryCode}${psu}` : 'N/A';
    const province = data['soilFER_collect/soil_description_sampling/Site_identification/selected_province'] || '';

    const surveyor = data['soilFER_collect/section0_general_Info/surveyor_name'] || data['username'] || '';
    const surveyDate = data['today'] || data['start']?.split('T')[0];

    let lat = null, lon = null, elev = null;
    const geopointStr = data['soilFER_collect/soil_description_sampling/Site_identification/geopoint'];
    if (geopointStr) {
        const parts = geopointStr.split(' ');
        lat = parts[0];
        lon = parts[1];
        elev = parts[2];
    } else if (data['_geolocation']) {
        lat = data['_geolocation'][0];
        lon = data['_geolocation'][1];
    }

    // Landform - HND uses landscape_description path
    const landform = data['soilFER_collect/landscape_description/landform_classification'] ||
                     data['soilFER_collect/landscape_description/landform_classification_GTM'] || '';

    // ARRAY-BASED STRUCTURE (HND uses same structure as GTM)
    const landcoverArr = data['soilFER_collect/landcover_description'];
    const isArrayBased = Array.isArray(landcoverArr) && landcoverArr.length > 0;

    let level1Class = '';
    const components = [];

    if (isArrayBased) {
        // === ARRAY-BASED STRUCTURE ===
        // Level 1 classification from last array item
        const lastComponent = landcoverArr[landcoverArr.length - 1];
        const prefix = 'soilFER_collect/landcover_description/dominant_landcover/';
        level1Class = lastComponent[`${prefix}land_cover_types`] || '';

        // Process each component in array
        landcoverArr.forEach((component, idx) => {
            const cultivatedPrefix = `${prefix}group_mz57q81/Cultivated_vegatation/`;

            const landcover = component[`${prefix}landcover`] || '';
            const maximum = component[`${prefix}Maximum`];
            const pct = parseFloat(maximum) || 0;

            // Build details
            const details = [];

            // Vegetated fields
            const mainVegType = component[`${cultivatedPrefix}main_vegetation_type`];
            const artificiality = component[`${prefix}group_mz57q81/vegetation_artificiality_001`];
            const category = component[`${cultivatedPrefix}category_001`];

            // Non-vegetated fields
            const artificialSurfacesGroup = `${prefix}artificial_surfaces_group/`;
            const nonVegArea = component[`${artificialSurfacesGroup}Non_vegetated_area`];
            const nonVegOffSeasonType = component[`${artificialSurfacesGroup}off_season_type`];

            // Get crop detail based on category
            let cropDetail = '';
            if (category === 'basic_grains') {
                cropDetail = component[`${cultivatedPrefix}basic_grains`];
            } else if (category === 'crops_shrubs') {
                cropDetail = component[`${cultivatedPrefix}crops_shrubs`];
            } else if (category === 'crops_trees') {
                cropDetail = component[`${cultivatedPrefix}crops_trees`];
            } else if (category === 'crops_annual') {
                cropDetail = component[`${cultivatedPrefix}crops_annual`];
                if (cropDetail === 'other') {
                    cropDetail = component[`${cultivatedPrefix}other_crops_annual`] || 'other';
                }
            } else if (category === 'natural_pastures') {
                cropDetail = component[`${cultivatedPrefix}natural_pastures`];
            }

            const season = component[`${cultivatedPrefix}season`];
            const onSeasonType = component[`${cultivatedPrefix}on_season_type`];
            const vegOffSeasonType = component[`${cultivatedPrefix}off_season_type`];
            const frequency = component[`${cultivatedPrefix}frequency`];
            const waterSupply = component[`${cultivatedPrefix}water_supply`];

            if (landcover) details.push(`landcover: ${landcover}`);
            if (mainVegType) details.push(`veg_type: ${mainVegType}`);
            if (artificiality) details.push(`artificiality: ${artificiality}`);
            if (category) details.push(`category: ${category}`);
            if (cropDetail) details.push(`crop: ${cropDetail}`);
            if (season) details.push(`season: ${season}`);
            if (onSeasonType) details.push(`on_season_type: ${onSeasonType}`);
            if (vegOffSeasonType) details.push(`off_season_type: ${vegOffSeasonType}`);
            if (frequency) details.push(`frequency: ${frequency}`);
            if (waterSupply) details.push(`water: ${waterSupply}`);
            // Non-vegetated specific fields
            if (nonVegArea) details.push(`area_type: ${nonVegArea}`);
            if (nonVegOffSeasonType) details.push(`nonveg_off_season_type: ${nonVegOffSeasonType}`);

            // Classification: landcover type (vegetated/non-vegetated)
            let classification = landcover;

            components.push({
                classification,
                percentage: pct,
                details: details.join(' | ')
            });
        });
    }

    const uniqueClasses = [level1Class].filter(Boolean);
    const totalPercentage = components.reduce((acc, c) => acc + c.percentage, 0);

    // Photos - HND uses landscape_description path
    const photoPath = 'soilFER_collect/landscape_description/land_feature_photos';
    const pNorth = data[`${photoPath}/photo_north`];
    const pEast = data[`${photoPath}/photo_east`];
    const pSouth = data[`${photoPath}/photo_south`];
    const pWest = data[`${photoPath}/photo_west`];

    const attachments = data['_attachments'] || [];
    const getUrl = (direction) => {
        const xpath = `${photoPath}/photo_${direction}`;
        const att = attachments.find(a => a.question_xpath && a.question_xpath === xpath);
        if (!att || !att.download_url) return '';

        // Remove ?format=json parameter to get actual file
        // KoboToolbox URLs like: .../attachments/123/?format=json
        // Need to become: .../attachments/123/
        return att.download_url.replace(/\?format=json$/i, '');
    };

    const comments = data['soilFER_collect/soil_description_sampling/barcode_scan/other_comments'] || '';
    const surveyorComments = data['soilFER_collect/soil_description_sampling/final_comments_site'] || '';

    processedItems.push({
        json: {
            uuid,
            country_code: countryCode,
            site_id: siteId,
            psu_id: psuId,
            province,
            surveyor,
            survey_date: surveyDate,
            submission_time: submissionTime,
            latitude: lat,
            longitude: lon,
            elevation: elev,
            landform,

            land_cover_types: level1Class,
            unique_classifications: uniqueClasses.join(', '),
            classification_count: uniqueClasses.length,
            total_percentage: totalPercentage,
            component_count: components.length,

            comp1_classification: components[0]?.classification || '',
            comp1_percentage: components[0]?.percentage || '',
            comp1_details: components[0]?.details || '',

            comp2_classification: components[1]?.classification || '',
            comp2_percentage: components[1]?.percentage || '',
            comp2_details: components[1]?.details || '',

            comp3_classification: components[2]?.classification || '',
            comp3_percentage: components[2]?.percentage || '',
            comp3_details: components[2]?.details || '',

            comp4_classification: components[3]?.classification || '',
            comp4_percentage: components[3]?.percentage || '',
            comp4_details: components[3]?.details || '',

            download_url_north: getUrl('north'),
            download_url_east: getUrl('east'),
            download_url_south: getUrl('south'),
            download_url_west: getUrl('west'),

            filename_north: generateImageName(uuid, 'North', pNorth),
            filename_east: generateImageName(uuid, 'East', pEast),
            filename_south: generateImageName(uuid, 'South', pSouth),
            filename_west: generateImageName(uuid, 'West', pWest),

            comments,

            validation_status: 'PENDING',
            is_correct: '',
            final_classification: '',
            main_crop_type: '',
            validator_comments: '',
            validator_name: '',
            validation_date: '',
            surveyor_comments: surveyorComments,
            workflow_date: new Date().toISOString()
        }
    });
}

return processedItems;
