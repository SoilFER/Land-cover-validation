// TUN COMPREHENSIVE TRANSFORMATION - CORRECTED VERSION
// Handles vegetated (with percentages), non-vegetated (no percentages), and water (no percentages)
// Key insight: ALL vegetation percentages are in cultivated_arable_land_group, regardless of natural/cultivated

function parsePercentage(value) {
    if (!value) return 0;
    const str = String(value);
    if (str.includes('_')) {
        const parts = str.split('_').map(Number);
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            // Return MAX value
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
    const countryCode = 'TUN';
    const submissionTime = data['_submission_time'];

    const siteId = data['soilFER_collect/soil_description_sampling/Site_identification/site_id'] || 'UNKNOWN_SITE';
    const psuId = siteId ? siteId.split(/[-_]/)[0] : 'N/A';
    const province = data['soilFER_collect/soil_description_sampling/Site_identification/selected_province'] || '';

    const surveyor = data['soilFER_collect/section0_general_Info/_3_Surveyor_s_Full_Name'] ||
                     data['soilFER_collect/section0_general_Info/surveyor_name'] ||
                     data['username'] || '';
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

    const landform = data['soilFER_collect/soil_description_sampling/erosion_status/landscape_description/landform_classification'] || '';

    const lcPath = 'soilFER_collect/soil_description_sampling/erosion_status/landcover_description';
    const level1Class = data[`${lcPath}/land_cover_types`] || '';

    const components = [];

    // Component 1: Dominant landcover
    const domPath = `${lcPath}/dominant_landcover`;
    const domLandcover = data[`${domPath}/landcover`];

    if (domLandcover) {
        const details = [];
        let pct = 0;

        if (domLandcover === 'vegetated') {
            // VEGETATED: Always check cultivated_arable_land_group for percentage data
            const groupPath = `${domPath}/cultivated_arable_land_group`;
            const mainVegType = data[`${groupPath}/main_vegetation_type`];

            // Get percentage based on vegetation type
            let min = null, max = null;
            if (mainVegType === 'herbaceous') {
                min = data[`${groupPath}/Minimum_percentage_cover_herb`];
                max = data[`${groupPath}/Maximum_percentage_cover_herb`];
            } else if (mainVegType === 'shrubs' || mainVegType === 'schrubs') {
                min = data[`${groupPath}/Minimum_percentage_cover_shrub`];
                max = data[`${groupPath}/Maximum_percentage_cover_shrub`];
            } else if (mainVegType === 'trees') {
                min = data[`${groupPath}/Minimum_percentage_cover_tree`];
                max = data[`${groupPath}/Maximum_percentage_cover_tree`];
            }

            pct = parsePercentage(max) || parsePercentage(min) || 0;

            const artificiality = data[`${groupPath}/vegetation_artificiality`];
            const category = data[`${groupPath}/category`];
            const other = data[`${groupPath}/other`];

            // Get crop detail based on category
            let cropDetail = '';
            if (category === 'oilseed_crops') {
                cropDetail = data[`${groupPath}/oilseed_crops`];
            } else if (category === 'basic_grains') {
                cropDetail = data[`${groupPath}/basic_grains`];
            } else if (category === 'leguminous_crops') {
                cropDetail = data[`${groupPath}/leguminous_crops`];
            } else if (category === 'fodder_crops') {
                cropDetail = data[`${groupPath}/fodder_crops`];
            } else if (category === 'industrial_crops') {
                cropDetail = data[`${groupPath}/industrial_crops`];
            } else if (category === 'vegetable_crops') {
                cropDetail = data[`${groupPath}/vegetable_crops`];
            } else if (category === 'fruit_crops') {
                cropDetail = data[`${groupPath}/fruit_crops`];
            } else if (category === 'fruit_nuts') {
                cropDetail = data[`${groupPath}/fruit_nuts`];
            } else if (category === 'other') {
                cropDetail = other;
            }

            const season = data[`${groupPath}/season`];
            const onSeasonType = data[`${groupPath}/on_season_type`];
            const offSeasonType = data[`${groupPath}/off_season_type`];
            const frequency = data[`${groupPath}/frequency`];
            const plantMinHeight = data[`${groupPath}/plant_minimum_height`];
            const plantMaxHeight = data[`${groupPath}/plant_maximum_height`];
            const waterSupply = data[`${groupPath}/water_supply`];

            if (domLandcover) details.push(`landcover: ${domLandcover}`);
            if (mainVegType) details.push(`veg_type: ${mainVegType}`);
            if (artificiality) details.push(`artificiality: ${artificiality}`);
            if (category) details.push(`category: ${category}`);
            if (cropDetail) details.push(`crop: ${cropDetail}`);
            if (season) details.push(`season: ${season}`);
            if (onSeasonType) details.push(`on_season_type: ${onSeasonType}`);
            if (offSeasonType) details.push(`off_season_type: ${offSeasonType}`);
            if (frequency) details.push(`frequency: ${frequency}`);
            if (plantMinHeight) details.push(`plant_min_height: ${plantMinHeight}`);
            if (plantMaxHeight) details.push(`plant_max_height: ${plantMaxHeight}`);
            if (waterSupply) details.push(`water: ${waterSupply}`);

        } else if (domLandcover === 'non-vegetated') {
            // NON-VEGETATED: Check artificial_surfaces_group (NO percentage fields)
            const groupPath = `${domPath}/artificial_surfaces_group`;
            const nonVegArea = data[`${groupPath}/Non_vegetated_area`];
            const naturalSurface = data[`${groupPath}/Natural_surface`];
            const artificialSurface = data[`${groupPath}/artificial_surfaces`];
            const offSeasonType = data[`${groupPath}/off_season_type`];

            // Non-vegetated surfaces don't have percentage fields (leave empty or 0)
            pct = 0;

            if (domLandcover) details.push(`landcover: ${domLandcover}`);
            if (nonVegArea) details.push(`area_type: ${nonVegArea}`);
            if (naturalSurface) details.push(`natural_surface: ${naturalSurface}`);
            if (artificialSurface) details.push(`artificial_surface: ${artificialSurface}`);
            if (offSeasonType) details.push(`off_season: ${offSeasonType}`);

        } else if (domLandcover === 'water') {
            // WATER: Check water_group (NO percentage fields)
            const groupPath = `${domPath}/water_group`;
            const waterType = data[`${groupPath}/water_type`];

            pct = 0;

            if (domLandcover) details.push(`landcover: ${domLandcover}`);
            if (waterType) details.push(`water_type: ${waterType}`);
        }

        components.push({
            classification: domLandcover,
            percentage: pct,
            details: details.join(' | ')
        });
    }

    // Component 2: Secondary vegetation (only if cultivated_arable_land_group exists)
    const groupPath = `${domPath}/cultivated_arable_land_group`;
    const hasSecondary = data[`${groupPath}/any_secondary_veg`];

    if (hasSecondary === 'yes') {
        const secVegType = data[`${groupPath}/secondary_vegetation_type`] || 'Secondary';
        const details = [];

        let minSec = null, maxSec = null;
        if (secVegType === 'herbaceous') {
            minSec = data[`${groupPath}/min_perc_cover_secondary_herb`];
            maxSec = data[`${groupPath}/max_perc_cover_secondary_herb`];
        } else if (secVegType === 'shrubs' || secVegType === 'schrubs') {
            minSec = data[`${groupPath}/min_perc_cover_secondary_shrub`];
            maxSec = data[`${groupPath}/max_perc_cover_secondary_shrub`];
        } else if (secVegType === 'trees') {
            minSec = data[`${groupPath}/min_perc_cover_secondary_tree`];
            maxSec = data[`${groupPath}/max_perc_cover_secondary_tree`];
        }

        const pctSec = parsePercentage(maxSec) || parsePercentage(minSec) || 0;

        details.push(`secondary veg_type: ${secVegType}`);

        components.push({
            classification: 'vegetated',
            percentage: pctSec,
            details: details.join(' | ')
        });
    }

    // Component 3: Third vegetation (only if cultivated_arable_land_group exists)
    const hasThird = data[`${groupPath}/any_third_veg`];

    if (hasThird === 'yes') {
        const thirdVegType = data[`${groupPath}/third_vegetation_type`] || 'Third';
        const details = [];

        let minThird = null, maxThird = null;
        if (thirdVegType === 'herbaceous') {
            minThird = data[`${groupPath}/min_perc_cover_third_herb`];
            maxThird = data[`${groupPath}/max_perc_cover_third_herb`];
        } else if (thirdVegType === 'shrubs' || thirdVegType === 'schrubs') {
            minThird = data[`${groupPath}/min_perc_cover_third_shrub`];
            maxThird = data[`${groupPath}/max_perc_cover_third_shrub`];
        } else if (thirdVegType === 'trees') {
            minThird = data[`${groupPath}/min_perc_cover_third_tree`];
            maxThird = data[`${groupPath}/max_perc_cover_third_tree`];
        }

        const pctThird = parsePercentage(maxThird) || parsePercentage(minThird) || 0;

        details.push(`third veg_type: ${thirdVegType}`);

        components.push({
            classification: 'vegetated',
            percentage: pctThird,
            details: details.join(' | ')
        });
    }

    const uniqueClasses = [level1Class].filter(Boolean);
    const totalPercentage = components.reduce((acc, c) => acc + (c.percentage || 0), 0);

    // Photos
    const photoPath = 'soilFER_collect/soil_description_sampling/erosion_status/land_feature_photos';
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
